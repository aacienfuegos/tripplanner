"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { destinationSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";

// El orden de la lista se deriva de arrivalDate en vez de pedirle al usuario
// que reordene a mano — es lo que ya usa cityForDay() en el timeline del viaje.
async function reorderDestinations(tripId: string) {
  const destinations = await prisma.destination.findMany({
    where: { tripId },
    orderBy: { arrivalDate: "asc" },
    select: { id: true },
  });
  await Promise.all(
    destinations.map((d, i) => prisma.destination.update({ where: { id: d.id }, data: { order: i } }))
  );
}

function revalidateDestinationPaths(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/destinations`);
  revalidatePath("/trips");
  revalidatePath("/dashboard");
}

export async function createDestination(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = destinationSchema.parse(Object.fromEntries(formData));

  await prisma.destination.create({
    data: {
      tripId,
      city: data.city,
      country: data.country,
      arrivalDate: new Date(data.arrivalDate),
      departureDate: new Date(data.departureDate),
      notes: data.notes || null,
    },
  });

  await reorderDestinations(tripId);
  revalidateDestinationPaths(tripId);
}

export async function updateDestination(tripId: string, destinationId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = destinationSchema.parse(Object.fromEntries(formData));

  await prisma.destination.update({
    where: { id: destinationId, tripId },
    data: {
      city: data.city,
      country: data.country,
      arrivalDate: new Date(data.arrivalDate),
      departureDate: new Date(data.departureDate),
      notes: data.notes || null,
    },
  });

  await reorderDestinations(tripId);
  revalidateDestinationPaths(tripId);
}

export async function deleteDestination(tripId: string, destinationId: string) {
  await requireTripOwner(tripId);
  await prisma.destination.delete({ where: { id: destinationId, tripId } });
  revalidateDestinationPaths(tripId);
}
