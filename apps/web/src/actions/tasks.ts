"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { taskSchema } from "@/lib/schemas";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createTask(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = taskSchema.parse(Object.fromEntries(formData));

  await prisma.task.create({
    data: {
      tripId,
      title: data.title,
      notes: data.notes || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
    },
  });

  revalidatePath(`/trips/${tripId}/tasks`);
}

export async function updateTask(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = taskSchema.parse(Object.fromEntries(formData));

  await prisma.task.update({
    where: { id, tripId },
    data: {
      title: data.title,
      notes: data.notes || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
    },
  });

  revalidatePath(`/trips/${tripId}/tasks`);
}

export async function toggleTaskDone(tripId: string, id: string, done: boolean) {
  await requireTripOwner(tripId);
  await prisma.task.update({ where: { id, tripId }, data: { done } });
  revalidatePath(`/trips/${tripId}/tasks`);
}

export async function deleteTask(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.task.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/tasks`);
}
