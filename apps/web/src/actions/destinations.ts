"use server";

import { destinationSchema } from "@/lib/schemas";
import type { DestinationInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as destinations from "@/lib/services/destinations";

function toInput(formData: FormData): DestinationInput {
  const data = destinationSchema.parse(Object.fromEntries(formData));
  return { ...data, notes: data.notes || null };
}

export async function createDestination(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(destinations.createDestination(actor, tripId, toInput(formData)));
}

export async function updateDestination(tripId: string, destinationId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(destinations.updateDestination(actor, tripId, destinationId, toInput(formData)));
}

export async function deleteDestination(tripId: string, destinationId: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(destinations.deleteDestination(actor, tripId, destinationId));
}
