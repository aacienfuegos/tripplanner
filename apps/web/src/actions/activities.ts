"use server";

import { activitySchema } from "@/lib/schemas";
import type { ActivityInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as activities from "@/lib/services/activities";

function toInput(formData: FormData): ActivityInput {
  const data = activitySchema.parse(Object.fromEntries(formData));
  return {
    ...data,
    scheduledAt: data.scheduledAt || null,
    duration: data.duration ? parseInt(data.duration) : null,
    price: data.price ? parseFloat(data.price) : null,
    confirmationUrl: data.confirmationUrl || null,
  };
}

export async function createActivity(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(activities.createActivity(actor, tripId, toInput(formData)));
}

export async function updateActivity(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(activities.updateActivity(actor, tripId, id, toInput(formData)));
}

export async function updateActivityStatus(tripId: string, id: string, status: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(activities.updateActivityStatus(actor, tripId, id, status));
}

export async function deleteActivity(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(activities.deleteActivity(actor, tripId, id));
}
