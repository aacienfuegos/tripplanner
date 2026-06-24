import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const messages: Record<string, string> = {
    Configuration: "Error de configuración del servidor.",
    AccessDenied: "Acceso denegado.",
    Verification: "El enlace de verificación ha expirado.",
    Default: "Se produjo un error al iniciar sesión.",
  };

  const message = messages[searchParams.error ?? "Default"] ?? messages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Error de autenticación</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/signin" className={buttonVariants()}>
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
