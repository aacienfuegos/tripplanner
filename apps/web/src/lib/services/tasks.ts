import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { taskInputSchema, type TaskInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";

export async function createTask(actor: Actor, tripId: string, input: TaskInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(taskInputSchema, input);
  const created = await prisma.task.create({ data: { ...data, tripId, dueDate: toDate(data.dueDate) } });
  revalidatePath(`/trips/${tripId}/tasks`);
  return created;
}

export async function updateTask(actor: Actor, tripId: string, id: string, input: Partial<TaskInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(taskInputSchema.partial(), input);
  await orNotFound("Task", prisma.task.update({ where: { id, tripId }, data: { ...data, dueDate: toDate(data.dueDate) } }));
  revalidatePath(`/trips/${tripId}/tasks`);
}

export async function toggleTaskDone(actor: Actor, tripId: string, id: string, done: boolean) {
  await requireTrip(actor, tripId);
  await orNotFound("Task", prisma.task.update({ where: { id, tripId }, data: { done } }));
  revalidatePath(`/trips/${tripId}/tasks`);
}

export async function deleteTask(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Task", prisma.task.delete({ where: { id, tripId } }));
  revalidatePath(`/trips/${tripId}/tasks`);
}
