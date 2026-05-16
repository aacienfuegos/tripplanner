"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { flightSchema } from "@/lib/schemas";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
  return session.user.id;
}

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
    where: { id: flightId },
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
  await prisma.flight.delete({ where: { id: flightId } });
  revalidatePath(`/trips/${tripId}/flights`);
}
