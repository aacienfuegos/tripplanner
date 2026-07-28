import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { timingSafeStringEqual } from "@/lib/timing-safe";

export const DEV_USER_ID = "dev-local-user-001";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function notifyAdmin({ email, name }: { email?: string | null; name?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail || !email) return;

  const safeEmail = escapeHtml(email);
  const safeName = escapeHtml(name ?? email);
  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "noreply@tripplanner.app",
      to: adminEmail,
      subject: "Nueva solicitud de acceso — TripPlanner",
      html: `<p><strong>${safeName}</strong> (${safeEmail}) ha solicitado acceso a TripPlanner.</p><p><a href="${appUrl}/admin">Revisar en el panel de administración →</a></p>`,
    }),
  }).catch(() => {});
}

const providers: NextAuthConfig["providers"] = [
  ...authConfig.providers,
];

if (process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD) {
  providers.push(
    Credentials({
      id: "dev-credentials",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (
          email !== undefined &&
          password !== undefined &&
          timingSafeStringEqual(email.trim(), process.env.DEV_ADMIN_EMAIL!.trim()) &&
          timingSafeStringEqual(password, process.env.DEV_ADMIN_PASSWORD!)
        ) {
          return {
            id: DEV_USER_ID,
            email: process.env.DEV_ADMIN_EMAIL,
            name: "Dev Admin",
          };
        }
        return null;
      },
    })
  );
}

if (process.env.RESEND_API_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@tripplanner.app",
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async signIn({ user, email: emailMeta }) {
      // Magic link: primera llamada es solo para enviar el email, no para iniciar sesión
      if (emailMeta?.verificationRequest) return true;
      // El usuario dev siempre puede entrar (su estado se gestiona en events.signIn)
      if (user.id === DEV_USER_ID) return true;
      // Bloquear usuarios denegados
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { status: true },
      });
      if (dbUser?.status === "DENIED") return false;
      // PENDING y APPROVED obtienen sesión; (app)/layout.tsx redirige si PENDING
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // Auto-aprobar y marcar como admin al primer usuario con ese email
      if (user.email && user.email === process.env.ADMIN_EMAIL) {
        await prisma.user.update({ where: { id: user.id! }, data: { status: "APPROVED", isAdmin: true } });
        return;
      }
      // Auto-aprobar si el registro está abierto
      const settings = await prisma.settings.findUnique({ where: { id: "global" } });
      if (settings?.registrationOpen) {
        await prisma.user.update({ where: { id: user.id! }, data: { status: "APPROVED" } });
        return;
      }
      // Notificar al admin de la nueva solicitud
      await notifyAdmin({ email: user.email, name: user.name });
    },
    async signIn({ user }) {
      if (user.id === DEV_USER_ID) {
        await prisma.user.upsert({
          where: { id: DEV_USER_ID },
          update: { status: "APPROVED", isAdmin: true },
          create: {
            id: DEV_USER_ID,
            email: process.env.DEV_ADMIN_EMAIL!,
            name: "Dev Admin",
            status: "APPROVED",
            isAdmin: true,
          },
        });
      }
    },
  },
});
