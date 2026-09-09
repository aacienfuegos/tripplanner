"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDiveEquipment, updateDiveEquipment } from "@/actions/dive-equipment";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUSES, equipmentCategoryLabels, equipmentStatusLabels } from "@/lib/equipment-category";
import type { DiveEquipment } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  equipment?: DiveEquipment;
  onSuccess: () => void;
}

export function EquipmentForm({ equipment: e, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const categoryLabels = equipmentCategoryLabels(t);
  const statusLabels = equipmentStatusLabels(t);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (e) {
          await updateDiveEquipment(e.id, formData);
          toast.success(t.toastUpdated);
        } else {
          await createDiveEquipment(formData);
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">{t.equipmentName} *</Label>
          <Input id="name" name="name" required defaultValue={e?.name ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">{t.equipmentCategory} *</Label>
          <Select name="category" defaultValue={e?.category ?? "OTHER"}>
            <SelectTrigger id="category">
              <SelectValue>{(value: string) => categoryLabels[value as keyof typeof categoryLabels] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">{t.equipmentStatus}</Label>
          <Select name="status" defaultValue={e?.status ?? "OWNED"}>
            <SelectTrigger id="status">
              <SelectValue>{(value: string) => statusLabels[value as keyof typeof statusLabels] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">{t.equipmentBrand}</Label>
          <Input id="brand" name="brand" defaultValue={e?.brand ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">{t.equipmentModel}</Label>
          <Input id="model" name="model" defaultValue={e?.model ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size">{t.equipmentSize}</Label>
          <Input id="size" name="size" defaultValue={e?.size ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serialNumber">{t.equipmentSerialNumber}</Label>
          <Input id="serialNumber" name="serialNumber" defaultValue={e?.serialNumber ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purchaseDate">{t.equipmentPurchaseDate}</Label>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            defaultValue={e?.purchaseDate ? format(e.purchaseDate, "yyyy-MM-dd") : ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purchasePrice">{t.equipmentPurchasePrice}</Label>
          <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" min="0" defaultValue={e?.purchasePrice ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastServiceDate">{t.equipmentLastServiceDate}</Label>
          <Input
            id="lastServiceDate"
            name="lastServiceDate"
            type="date"
            defaultValue={e?.lastServiceDate ? format(e.lastServiceDate, "yyyy-MM-dd") : ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serviceIntervalMonths">{t.equipmentServiceInterval}</Label>
          <Input
            id="serviceIntervalMonths"
            name="serviceIntervalMonths"
            type="number"
            min="0"
            defaultValue={e?.serviceIntervalMonths ?? ""}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={e?.notes ?? ""} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : e ? t.saveChanges : t.addEquipment}
      </Button>
    </form>
  );
}
