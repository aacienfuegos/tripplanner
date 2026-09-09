import { redirect } from "next/navigation";
import { Plane } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getT } from "@/lib/locale";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [t, user] = await Promise.all([
    getT(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
  ]);

  if (user?.name) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Plane className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">{t.welcomeTitle}</h1>
          <p className="text-muted-foreground">{t.welcomeSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.completeProfileTitle}</CardTitle>
            <CardDescription>{t.completeProfileDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
