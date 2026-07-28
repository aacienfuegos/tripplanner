"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateProfile } from "@/actions/profile";
import { useT } from "@/contexts/LanguageContext";

interface ProfileFormProps {
  user: { name: string | null; image: string | null };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateProfile(formData);
        toast.success(t.profileUpdatedToast);
      } catch {
        toast.error(t.profileErrorSavingToast);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.editProfileTitle}</CardTitle>
        <CardDescription>{t.editProfileDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.nameLabel}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t.fullNamePlaceholder}
              defaultValue={user.name ?? ""}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="image">{t.photoUrlLabel}</Label>
            <Input
              id="image"
              name="image"
              type="url"
              placeholder={t.photoUrlPlaceholder}
              defaultValue={user.image ?? ""}
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t.savingEllipsis : t.saveChanges}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
