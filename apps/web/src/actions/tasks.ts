"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";

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
