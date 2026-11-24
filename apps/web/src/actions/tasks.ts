"use server";

import { taskSchema } from "@/lib/schemas";
import type { TaskInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as tasks from "@/lib/services/tasks";

function toInput(formData: FormData): TaskInput {
  const data = taskSchema.parse(Object.fromEntries(formData));
  return { ...data, notes: data.notes || null, dueDate: data.dueDate || null };
}

export async function createTask(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(tasks.createTask(actor, tripId, toInput(formData)));
}

export async function updateTask(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(tasks.updateTask(actor, tripId, id, toInput(formData)));
}

export async function toggleTaskDone(tripId: string, id: string, done: boolean) {
  const actor = await webActor();
  await redirectIfTripNotFound(tasks.toggleTaskDone(actor, tripId, id, done));
}

export async function deleteTask(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(tasks.deleteTask(actor, tripId, id));
}
