"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PackingItem, Suitcase } from "@/types";
import { useT } from "@/contexts/LanguageContext";

// Select values can't be null; "no bag" travels as this sentinel inside the form.
const NO_SUITCASE = "none";

interface Props {
  categories: readonly string[];
  suitcases: readonly Suitcase[];
  item?: PackingItem;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<boolean>;
  onCancel: () => void;
}

// Shared by the inline "add" form, which stays open and keeps the category and
// bag after each item, and the edit dialog.
export function PackingItemForm({ categories, suitcases, item, submitLabel, onSubmit, onCancel }: Props) {
  const { t } = useT();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? t.otherLabel);
  const [customCategory, setCustomCategory] = useState("");
  const [suitcaseId, setSuitcaseId] = useState(item?.suitcaseId ?? NO_SUITCASE);
  const [isPending, setIsPending] = useState(false);

  const options = [...new Set([...categories, ...(item ? [item.category] : []), t.otherLabel])];
  const selectedSuitcase = suitcases.some((s) => s.id === suitcaseId) ? suitcaseId : NO_SUITCASE;
  const suitcaseName = (value: string) => suitcases.find((s) => s.id === value)?.name ?? t.noSuitcase;

  async function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const quantity = Number(formData.get("quantity"));
    const finalCategory = category === t.otherLabel ? customCategory.trim() : category;
    if (!name) { toast.error(t.nameRequiredError); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { toast.error(t.packingQuantityInvalid); return; }
    if (!finalCategory) { toast.error(t.enterCategoryError); return; }
    formData.set("category", finalCategory);
    formData.set("suitcaseId", selectedSuitcase === NO_SUITCASE ? "" : selectedSuitcase);
    setIsPending(true);
    const ok = await onSubmit(formData);
    setIsPending(false);
    if (ok && !item) { formRef.current?.reset(); setCustomCategory(""); }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-32">
          <Label htmlFor={`${id}-name`} className="sr-only">{t.itemLabel}</Label>
          <Input id={`${id}-name`} name="name" placeholder={t.itemNamePlaceholder} defaultValue={item?.name} required />
        </div>
        <Label htmlFor={`${id}-quantity`} className="sr-only">{t.quantity}</Label>
        <Input
          id={`${id}-quantity`}
          name="quantity"
          type="number"
          defaultValue={String(item?.quantity ?? 1)}
          className="w-20"
          min="1"
          step="1"
        />
      </div>
      <div className="flex gap-3 flex-wrap items-start">
        <div className="flex-1 min-w-36">
          <Select value={category} onValueChange={(v) => v !== null && setCategory(v)}>
            <SelectTrigger aria-label={t.packingCategory}><SelectValue placeholder={t.packingCategory} /></SelectTrigger>
            <SelectContent>
              {options.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {category === t.otherLabel && (
          <Input
            className="flex-1 min-w-28"
            placeholder={t.categoryNamePlaceholder}
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            required
          />
        )}
        <div className="flex-1 min-w-36">
          <Select value={selectedSuitcase} onValueChange={(v) => v !== null && setSuitcaseId(v)}>
            <SelectTrigger aria-label={t.suitcase}>
              <SelectValue>{(value: string) => suitcaseName(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SUITCASE}>{t.noSuitcase}</SelectItem>
              {suitcases.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>{t.cancel}</Button>
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
