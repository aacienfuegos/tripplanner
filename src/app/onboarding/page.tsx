import { redirect } from "next/navigation";
import { Plane } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

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
          <h1 className="text-2xl font-bold">¡Bienvenido a TripPlanner!</h1>
          <p className="text-muted-foreground">Antes de empezar, cuéntanos cómo te llamas.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Completa tu perfil</CardTitle>
            <CardDescription>Solo necesitamos tu nombre para personalizar la experiencia.</CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
