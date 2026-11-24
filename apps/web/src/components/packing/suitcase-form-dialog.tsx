"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { SUITCASE_TYPES, parseWeightInput, weightInputValue, type SuitcaseType, type UnitSystem } from "@tripplanner/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSuitcase, updateSuitcase } from "@/actions/suitcases";
import type { Suitcase } from "@/types";
import type { WebTKeys } from "@/i18n";
import { useT } from "@/contexts/LanguageContext";

export function suitcaseTypeLabel(t: WebTKeys, type: SuitcaseType): string {
  const labels: Record<SuitcaseType, string> = {
    CABIN: t.suitcaseTypeCabin,
    CHECKED: t.suitcaseTypeChecked,
    BACKPACK: t.suitcaseTypeBackpack,
    OTHER: t.suitcaseTypeOther,
  };
  return labels[type];
}

interface Props {
  tripId: string;
  unitSystem: UnitSystem;
  open: boolean;
  suitcase: Suitcase | null;
  onOpenChange: (open: boolean) => void;
}

export function SuitcaseFormDialog({ tripId, unitSystem, open, suitcase, onOpenChange }: Props) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{suitcase ? t.editSuitcase : t.newSuitcase}</DialogTitle>
        </DialogHeader>
        {/* Keyed so each opening starts from the bag being edited, or empty. */}
        <SuitcaseForm
          key={suitcase?.id ?? "new"}
          tripId={tripId}
          unitSystem={unitSystem}
          suitcase={suitcase}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SuitcaseForm({ tripId, unitSystem, suitcase, onDone }: {
  tripId: string;
  unitSystem: UnitSystem;
  suitcase: Suitcase | null;
  onDone: () => void;
}) {
  const { t } = useT();
  const id = useId();
  const initialWeight = weightInputValue(suitcase?.weightGrams ?? null, unitSystem);
  const [name, setName] = useState(suitcase?.name ?? "");
  const [type, setType] = useState<SuitcaseType>(suitcase?.type ?? "OTHER");
  const [weight, setWeight] = useState(initialWeight);
  const [errors, setErrors] = useState<{ name?: string; weight?: string }>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseWeightInput(weight, unitSystem);
    const nextErrors = {
      ...(name.trim() ? {} : { name: t.nameRequiredError }),
      ...(parsed.ok ? {} : { weight: t.suitcaseWeightInvalid }),
    };
    setErrors(nextErrors);
    if (!parsed.ok || nextErrors.name) return;

    // An untouched weight keeps its grams: the field shows one decimal, so
    // re-parsing it can change the stored value (9979 g shows as "10.0" kg).
    const weightGrams = suitcase && weight === initialWeight ? suitcase.weightGrams : parsed.grams;
    const input = { name: name.trim(), type, weightGrams };
    setIsPending(true);
    try {
      if (suitcase) await updateSuitcase(tripId, suitcase.id, input);
      else await createSuitcase(tripId, input);
      onDone();
    } catch (error) {
      if (isRedirectError(error)) throw error;
      toast.error(t.error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>{t.suitcaseNameLabel}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-type`}>{t.suitcaseTypeLabel}</Label>
        <Select value={type} onValueChange={(v) => v !== null && setType(v)}>
          <SelectTrigger id={`${id}-type`}>
            <SelectValue>{() => suitcaseTypeLabel(t, type)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUITCASE_TYPES.map((s) => <SelectItem key={s} value={s}>{suitcaseTypeLabel(t, s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-weight`}>{t.suitcaseWeightLabel(unitSystem === "IMPERIAL" ? "lb" : "kg")}</Label>
        <Input
          id={`${id}-weight`}
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-invalid={errors.weight ? true : undefined}
        />
        {errors.weight && <p className="text-sm text-destructive">{errors.weight}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>{t.cancel}</Button>
        <Button type="submit" disabled={isPending}>{t.save}</Button>
      </DialogFooter>
    </form>
  );
}
