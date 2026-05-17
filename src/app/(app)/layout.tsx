import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, name: true, image: true },
  });

  if (!user || user.status === "DENIED") redirect("/auth/error?error=AccessDenied");
  if (user.status === "PENDING") redirect("/auth/pending");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={{ name: user.name, email: session.user.email, image: user.image }} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
