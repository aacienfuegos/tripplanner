"use server";

import { expenseSchema } from "@/lib/schemas";
import type { ExpenseInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as expenses from "@/lib/services/expenses";

function toInput(formData: FormData): ExpenseInput {
  const data = expenseSchema.parse(Object.fromEntries(formData));
  return { ...data, amount: parseFloat(data.amount), paid: data.paid === "true" };
}

export async function createExpense(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(expenses.createExpense(actor, tripId, toInput(formData)));
}

export async function updateExpense(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(expenses.updateExpense(actor, tripId, id, toInput(formData)));
}

export async function toggleExpensePaid(tripId: string, id: string, paid: boolean) {
  const actor = await webActor();
  await redirectIfTripNotFound(expenses.toggleExpensePaid(actor, tripId, id, paid));
}

export async function deleteExpense(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(expenses.deleteExpense(actor, tripId, id));
}
