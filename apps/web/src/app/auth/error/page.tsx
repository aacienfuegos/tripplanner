import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/lib/locale";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [t, { error }] = await Promise.all([getT(), searchParams]);

  const messages: Record<string, string> = {
    Configuration: t.authErrorConfig,
    AccessDenied: t.authErrorAccessDenied,
    Verification: t.authErrorVerification,
    Default: t.authErrorDefault,
  };

  const message = messages[error ?? "Default"] ?? messages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>{t.authErrorTitle}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/signin" className={buttonVariants()}>
            {t.backToSignInBtn}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
