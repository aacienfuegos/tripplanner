import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { ClientProviders } from "@/components/layout/ClientProviders";
import { getLocale } from "@/lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [user, locale] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, name: true, image: true, isAdmin: true },
    }),
    getLocale(),
  ]);

  if (!user || user.status === "DENIED") redirect("/auth/error?error=AccessDenied");
  if (user.status === "PENDING") redirect("/auth/pending");
  if (!user.name) redirect("/onboarding");

  return (
    <ClientProviders initialLocale={locale}>
      <div className="min-h-screen flex flex-col">
        <Navbar user={{ name: user.name, email: session.user.email, image: user.image, isAdmin: user.isAdmin }} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </ClientProviders>
  );
}
