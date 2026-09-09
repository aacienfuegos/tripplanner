"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDiveEquipmentService } from "@/actions/dive-equipment";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  equipmentId: string;
  onSuccess: () => void;
}

export function EquipmentServiceForm({ equipmentId, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("equipmentId", equipmentId);
    startTransition(async () => {
      try {
        await createDiveEquipmentService(formData);
        toast.success(t.toastAdded);
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service-date">{t.equipmentServiceDate} *</Label>
          <Input id="service-date" name="date" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-cost">{t.equipmentServiceCost}</Label>
          <Input id="service-cost" name="cost" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="service-description">{t.equipmentServiceDescription} *</Label>
          <Input id="service-description" name="description" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-notes">{t.notes}</Label>
        <Textarea id="service-notes" name="notes" rows={2} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : t.equipmentAddService}
      </Button>
    </form>
  );
}
