"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpense, updateExpense } from "@/actions/expenses";
import type { Expense } from "@/types";
import { format } from "date-fns";
import { useT } from "@/contexts/LanguageContext";
import { CURRENCIES } from "@/lib/exchangeRate";

interface Props { tripId: string; expense?: Expense; currency: string; tripStartDate: Date; onSuccess: () => void; }

export function ExpenseForm({ tripId, expense: e, currency, tripStartDate, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const defaultCurrency = e?.currency ?? currency;
  const currencyOptions = CURRENCIES.includes(defaultCurrency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [defaultCurrency, ...CURRENCIES];

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (e) { await updateExpense(tripId, e.id, formData); toast.success(t.toastUpdated); }
        else { await createExpense(tripId, formData); toast.success(t.toastAdded); }
        onSuccess();
      } catch { toast.error(t.toastErrorSaving); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">{t.descriptionLabel} *</Label>
        <Input id="description" name="description" required defaultValue={e?.description} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">{t.category}</Label>
          <Select name="category" defaultValue={e?.category ?? "OTHER"}>
            <SelectTrigger id="category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["FLIGHT","ACCOMMODATION","FOOD","TRANSPORT","ACTIVITY","SHOPPING","OTHER"].map(c => (
                <SelectItem key={c} value={c}>{c.charAt(0)+c.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">{t.amount} *</Label>
          <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={e?.amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{t.tripCurrency}</Label>
          <Select name="currency" defaultValue={defaultCurrency}>
            <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencyOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">{t.expenseDate} *</Label>
          <Input id="date" name="date" type="date" required defaultValue={e ? format(e.date, "yyyy-MM-dd") : format(tripStartDate, "yyyy-MM-dd")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={e?.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="paid" name="paid" value="true" defaultChecked={e?.paid} className="h-4 w-4" />
        <Label htmlFor="paid">{t.alreadyPaidLabel}</Label>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : e ? t.saveChanges : t.addExpense}
      </Button>
    </form>
  );
}
