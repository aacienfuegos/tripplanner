"use server";

import { accommodationSchema } from "@/lib/schemas";
import type { AccommodationInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as accommodations from "@/lib/services/accommodations";

function toInput(formData: FormData): AccommodationInput {
  const data = accommodationSchema.parse(Object.fromEntries(formData));
  return {
    ...data,
    price: data.price ? parseFloat(data.price) : null,
    pricePerNight: data.pricePerNight ? parseFloat(data.pricePerNight) : null,
    confirmationUrl: data.confirmationUrl || null,
  };
}

export async function createAccommodation(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(accommodations.createAccommodation(actor, tripId, toInput(formData)));
}

export async function updateAccommodation(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(accommodations.updateAccommodation(actor, tripId, id, toInput(formData)));
}

export async function deleteAccommodation(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(accommodations.deleteAccommodation(actor, tripId, id));
}
