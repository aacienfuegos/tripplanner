"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateProfile } from "@/actions/profile";

interface ProfileFormProps {
  user: { name: string | null; image: string | null };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateProfile(formData);
        toast.success("Perfil actualizado");
      } catch {
        toast.error("Error al guardar el perfil");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar perfil</CardTitle>
        <CardDescription>Actualiza tu nombre y foto de perfil</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              placeholder="Tu nombre completo"
              defaultValue={user.name ?? ""}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="image">URL de foto</Label>
            <Input
              id="image"
              name="image"
              type="url"
              placeholder="https://ejemplo.com/foto.jpg"
              defaultValue={user.image ?? ""}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
