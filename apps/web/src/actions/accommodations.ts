"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accommodationSchema } from "@/lib/schemas";
import { geocodeAccommodation } from "@/lib/geocode-items";
import { requireTripOwner } from "@/lib/action-auth";

export async function createAccommodation(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = accommodationSchema.parse(Object.fromEntries(formData));

  const created = await prisma.accommodation.create({
    data: {
      tripId,
      ...data,
      checkIn: new Date(data.checkIn),
      checkOut: new Date(data.checkOut),
      price: data.price ? parseFloat(data.price) : null,
      pricePerNight: data.pricePerNight ? parseFloat(data.pricePerNight) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  void geocodeAccommodation(created.id);
  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function updateAccommodation(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = accommodationSchema.parse(Object.fromEntries(formData));

  await prisma.accommodation.update({
    where: { id, tripId },
    data: {
      ...data,
      checkIn: new Date(data.checkIn),
      checkOut: new Date(data.checkOut),
      price: data.price ? parseFloat(data.price) : null,
      pricePerNight: data.pricePerNight ? parseFloat(data.pricePerNight) : null,
      confirmationUrl: data.confirmationUrl || null,
      latitude: null,
      longitude: null,
    },
  });

  void geocodeAccommodation(id);
  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function deleteAccommodation(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.accommodation.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/accommodations`);
}
