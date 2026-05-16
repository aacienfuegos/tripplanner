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

interface Props { tripId: string; expense?: Expense; currency: string; tripStartDate: Date; onSuccess: () => void; }

export function ExpenseForm({ tripId, expense: e, currency, tripStartDate, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (e) { await updateExpense(tripId, e.id, formData); toast.success("Actualizado"); }
        else { await createExpense(tripId, formData); toast.success("Añadido"); }
        onSuccess();
      } catch { toast.error("Error al guardar"); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción *</Label>
        <Input id="description" name="description" required defaultValue={e?.description} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoría</Label>
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
          <Label htmlFor="amount">Importe *</Label>
          <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={e?.amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Moneda</Label>
          <Input id="currency" name="currency" defaultValue={e?.currency ?? currency} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha *</Label>
          <Input id="date" name="date" type="date" required defaultValue={e ? format(e.date, "yyyy-MM-dd") : format(tripStartDate, "yyyy-MM-dd")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={e?.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="paid" name="paid" value="true" defaultChecked={e?.paid} className="h-4 w-4" />
        <Label htmlFor="paid">Ya pagado</Label>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : e ? "Guardar cambios" : "Añadir gasto"}
      </Button>
    </form>
  );
}
