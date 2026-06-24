"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/actions/profile";

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await completeOnboarding(formData);
      } catch {
        toast.error("Error al guardar el perfil");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Tu nombre</Label>
        <Input
          id="name"
          name="name"
          placeholder="¿Cómo te llamamos?"
          autoFocus
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">Foto de perfil <span className="text-muted-foreground text-xs">(opcional)</span></Label>
        <Input
          id="image"
          name="image"
          type="url"
          placeholder="https://ejemplo.com/foto.jpg"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Guardando..." : "Empezar a planificar"}
      </Button>
    </form>
  );
}
