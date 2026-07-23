"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, DollarSign, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseForm } from "./expense-form";
import { deleteExpense, toggleExpensePaid } from "@/actions/expenses";
import type { Expense } from "@/types";

const catLabels: Record<string, string> = {
  FLIGHT: "Vuelo", ACCOMMODATION: "Alojamiento", FOOD: "Comida",
  TRANSPORT: "Transporte", ACTIVITY: "Actividad", SHOPPING: "Compras", OTHER: "Otro",
};

interface Props {
  tripId: string;
  expenses: Expense[];
  currency: string;
  budget: number | null;
  total: number;
  paid: number;
  tripStartDate: Date;
}

export function ExpensesList({ tripId, expenses, currency, budget, total, paid, tripStartDate }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    try { await deleteExpense(tripId, id); toast.success("Eliminado"); }
    catch { toast.error("Error al eliminar"); }
  }

  async function handleTogglePaid(e: Expense) {
    try { await toggleExpensePaid(tripId, e.id, !e.paid); }
    catch { toast.error("Error"); }
  }

  const amountInTripCurrency = (e: Expense) =>
    e.currency === currency ? e.amount : (e.convertedAmount ?? e.amount);

  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + amountInTripCurrency(e);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Añadir gasto
      </Button>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-sm text-muted-foreground">Total gastado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{total.toLocaleString()} {currency}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-sm text-muted-foreground">Pagado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{paid.toLocaleString()} {currency}</p></CardContent>
        </Card>
        {budget && (
          <Card>
            <CardHeader className="pb-1 pt-4"><CardTitle className="text-sm text-muted-foreground">Presupuesto restante</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${budget - total < 0 ? "text-destructive" : ""}`}>
                {(budget - total).toLocaleString()} {currency}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* By category */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory).map(([cat, amount]) => (
            <Badge key={cat} variant="secondary">
              {catLabels[cat]}: {amount.toLocaleString()} {currency}
            </Badge>
          ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No hay gastos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id} className={e.paid ? "opacity-70" : ""}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => handleTogglePaid(e)} className="shrink-0">
                    {e.paid
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : <Circle className="h-5 w-5 text-muted-foreground" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{e.description}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{catLabels[e.category]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(e.date, "d MMM yyyy", { locale: es })}
                      {e.notes && ` · ${e.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold">
                      {e.amount.toLocaleString()} {e.currency}
                      {e.currency !== currency && e.convertedAmount != null && (
                        <span className="text-muted-foreground font-normal text-xs">
                          {" "}(≈ {e.convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency})
                        </span>
                      )}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(e); setOpen(true); }}>✏️</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar gasto" : "Añadir gasto"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm tripId={tripId} expense={editing ?? undefined} currency={currency} tripStartDate={tripStartDate} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
