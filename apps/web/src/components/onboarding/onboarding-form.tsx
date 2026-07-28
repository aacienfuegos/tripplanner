"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/actions/profile";
import { useT } from "@/contexts/LanguageContext";

export function OnboardingForm() {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await completeOnboarding(formData);
      } catch {
        toast.error(t.profileErrorSavingToast);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t.yourNameLabel}</Label>
        <Input
          id="name"
          name="name"
          placeholder={t.nameQuestionPlaceholder}
          autoFocus
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">{t.profilePhotoLabel} <span className="text-muted-foreground text-xs">({t.optional.toLowerCase()})</span></Label>
        <Input
          id="image"
          name="image"
          type="url"
          placeholder={t.photoUrlPlaceholder}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t.savingEllipsis : t.startPlanningBtn}
      </Button>
    </form>
  );
}
