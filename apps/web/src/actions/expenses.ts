"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { expenseSchema } from "@/lib/schemas";
import { getExchangeRate } from "@/lib/exchangeRate";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true, currency: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
  return trip;
}

async function resolveConversion(expenseCurrency: string, tripCurrency: string, amount: number) {
  if (expenseCurrency === tripCurrency) return { exchangeRate: null, convertedAmount: null };
  const rate = await getExchangeRate(expenseCurrency, tripCurrency);
  if (rate === null) return { exchangeRate: null, convertedAmount: null };
  return { exchangeRate: rate, convertedAmount: amount * rate };
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
