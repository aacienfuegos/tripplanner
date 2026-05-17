import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/auth/signin" });
}

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });

  if (user?.status === "APPROVED") redirect("/dashboard");
  if (user?.status === "DENIED") redirect("/auth/error?error=AccessDenied");

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <Clock className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle>Acceso pendiente de aprobación</CardTitle>
          <CardDescription>
            Tu solicitud ha sido recibida. El administrador la revisará en breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Si ya te han aprobado, haz clic en Verificar para comprobarlo.
          </p>
          <a href="/auth/pending" className={buttonVariants({ variant: "outline" })}>
            Verificar acceso
          </a>
          <form action={handleSignOut}>
            <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-full"}>
              Cerrar sesión
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
