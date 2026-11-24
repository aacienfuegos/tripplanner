"use server";

import { redirect } from "next/navigation";
import { tripSchema } from "@/lib/schemas";
import type { TripInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as trips from "@/lib/services/trips";

function toInput(formData: FormData): TripInput {
  const data = tripSchema.parse(Object.fromEntries(formData));
  return { ...data, budget: data.budget ? parseFloat(data.budget) : null };
}

export async function createTrip(formData: FormData) {
  const actor = await webActor();
  const trip = await trips.createTrip(actor, toInput(formData));
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(trips.updateTrip(actor, tripId, toInput(formData)));
}

export async function deleteTrip(tripId: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(trips.deleteTrip(actor, tripId));
  redirect("/trips");
}

export async function updateTripStatus(tripId: string, status: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(trips.updateTripStatus(actor, tripId, status));
}
