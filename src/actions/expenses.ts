"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { expenseSchema } from "@/lib/schemas";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createExpense(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = expenseSchema.parse(Object.fromEntries(formData));
  await prisma.expense.create({
    data: {
      tripId,
      ...data,
      amount: parseFloat(data.amount),
      date: new Date(data.date),
      paid: data.paid === "true",
    },
  });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function updateExpense(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = expenseSchema.parse(Object.fromEntries(formData));
  await prisma.expense.update({
    where: { id },
    data: {
      ...data,
      amount: parseFloat(data.amount),
      date: new Date(data.date),
      paid: data.paid === "true",
    },
  });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function toggleExpensePaid(tripId: string, id: string, paid: boolean) {
  await requireTripOwner(tripId);
  await prisma.expense.update({ where: { id }, data: { paid } });
  revalidatePath(`/trips/${tripId}/expenses`);
}

export async function deleteExpense(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.expense.delete({ where: { id } });
  revalidatePath(`/trips/${tripId}/expenses`);
}
