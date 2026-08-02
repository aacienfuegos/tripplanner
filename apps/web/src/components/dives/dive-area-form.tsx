"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/dives/country-select";
import { createDiveArea, updateDiveArea } from "@/actions/dive-sites";
import type { DiveArea } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  area?: DiveArea;
  onSuccess: () => void;
}

export function DiveAreaForm({ area: a, onSuccess }: Props) {
  const { t, locale } = useT();
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState<string | undefined>(a?.country ?? undefined);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (a) {
          await updateDiveArea(a.id, formData);
          toast.success(t.toastUpdated);
        } else {
          await createDiveArea(formData);
          toast.success(t.toastAdded);
        }
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t.diveAreaName} *</Label>
        <Input id="name" name="name" required defaultValue={a?.name ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">{t.diveAreaCountry}</Label>
        <CountrySelect name="country" value={country} onValueChange={setCountry} locale={locale} noneLabel={t.countryNone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={a?.notes ?? ""} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : a ? t.saveChanges : t.addDiveArea}
      </Button>
    </form>
  );
}
