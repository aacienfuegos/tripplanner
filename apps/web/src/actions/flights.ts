"use server";

import { flightSchema } from "@/lib/schemas";
import type { FlightInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as flights from "@/lib/services/flights";

function toInput(formData: FormData): FlightInput {
  const data = flightSchema.parse(Object.fromEntries(formData));
  return {
    ...data,
    price: data.price ? parseFloat(data.price) : null,
    confirmationUrl: data.confirmationUrl || null,
  };
}

export async function createFlight(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(flights.createFlight(actor, tripId, toInput(formData)));
}

export async function updateFlight(tripId: string, flightId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(flights.updateFlight(actor, tripId, flightId, toInput(formData)));
}

export async function deleteFlight(tripId: string, flightId: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(flights.deleteFlight(actor, tripId, flightId));
}
