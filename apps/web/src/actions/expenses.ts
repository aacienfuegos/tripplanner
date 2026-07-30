"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/schemas";
import { getExchangeRate } from "@/lib/exchangeRate";
import { requireTripOwner } from "@/lib/action-auth";

async function resolveConversion(expenseCurrency: string, tripCurrency: string, amount: number) {
  if (expenseCurrency === tripCurrency) return { exchangeRate: null, convertedAmount: null };
  const rate = await getExchangeRate(expenseCurrency, tripCurrency);
  if (rate === null) return { exchangeRate: null, convertedAmount: null };
  return { exchangeRate: rate, convertedAmount: amount * rate };
}

// Los gastos guardan exchangeRate/convertedAmount calculados contra la moneda
// del viaje en el momento de crearse/editarse — si luego cambia trip.currency
// (updateTrip), esos valores quedan obsoletos y hay que recalcularlos todos,
// incluyendo los que antes tenían convertedAmount: null por coincidir con la
// moneda anterior del viaje.
export async function recalculateExpenseConversions(tripId: string, tripCurrency: string) {
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    select: { id: true, currency: true, amount: true },
  });

  await Promise.all(
    expenses.map(async (expense) => {
      const { exchangeRate, convertedAmount } = await resolveConversion(expense.currency, tripCurrency, expense.amount);
      await prisma.expense.update({ where: { id: expense.id }, data: { exchangeRate, convertedAmount } });
    }),
  );
}

export async function createExpense(tripId: string, formData: FormData) {
  const trip = await requireTripOwner(tripId);
  const data = expenseSchema.parse(Object.fromEntries(formData));
  const amount = parseFloat(data.amount);
  const { exchangeRate, convertedAmount } = await resolveConversion(data.currency, trip.currency, amount);
  await prisma.expense.create({
    data: {
      tripId,
      ...data,
      amount,
      exchangeRate,
      convertedAmount,
      date: new Date(data.date),
      paid: data.paid === "true",
    },
  });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function updateExpense(tripId: string, id: string, formData: FormData) {
  const trip = await requireTripOwner(tripId);
  const data = expenseSchema.parse(Object.fromEntries(formData));
  const amount = parseFloat(data.amount);
  const { exchangeRate, convertedAmount } = await resolveConversion(data.currency, trip.currency, amount);
  await prisma.expense.update({
    where: { id, tripId },
    data: {
      ...data,
      amount,
      exchangeRate,
      convertedAmount,
      date: new Date(data.date),
      paid: data.paid === "true",
    },
  });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function toggleExpensePaid(tripId: string, id: string, paid: boolean) {
  await requireTripOwner(tripId);
  await prisma.expense.update({ where: { id, tripId }, data: { paid } });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function deleteExpense(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.expense.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/expenses`);
}
