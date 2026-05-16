import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const DEV_USER_ID = "dev-local-user-001";

const providers: NextAuthConfig["providers"] = [
  ...authConfig.providers,
];

if (process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD) {
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
          email?.trim() === process.env.DEV_ADMIN_EMAIL?.trim() &&
          password === process.env.DEV_ADMIN_PASSWORD
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
    // Para credentials, authorized ya viene de authConfig
  },
  events: {
    // Asegura que el usuario dev existe en la DB al primer login
    async signIn({ user }) {
      if (user.id === DEV_USER_ID) {
        await prisma.user.upsert({
          where: { id: DEV_USER_ID },
          update: {},
          create: {
            id: DEV_USER_ID,
            email: process.env.DEV_ADMIN_EMAIL!,
            name: "Dev Admin",
          },
        });
      }
    },
  },
});
