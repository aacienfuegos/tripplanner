"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { flightSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";

export async function createFlight(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = flightSchema.parse(Object.fromEntries(formData));

  await prisma.flight.create({
    data: {
      tripId,
      ...data,
      departureAt: new Date(data.departureAt),
      arrivalAt: new Date(data.arrivalAt),
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  revalidatePath(`/trips/${tripId}/flights`);
}

export async function updateFlight(tripId: string, flightId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = flightSchema.parse(Object.fromEntries(formData));

  await prisma.flight.update({
    where: { id: flightId, tripId },
    data: {
      ...data,
      departureAt: new Date(data.departureAt),
      arrivalAt: new Date(data.arrivalAt),
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  revalidatePath(`/trips/${tripId}/flights`);
}

export async function deleteFlight(tripId: string, flightId: string) {
  await requireTripOwner(tripId);
  await prisma.flight.delete({ where: { id: flightId, tripId } });
  revalidatePath(`/trips/${tripId}/flights`);
}
