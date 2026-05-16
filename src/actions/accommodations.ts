"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const accommodationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOTEL", "HOSTEL", "AIRBNB", "APARTMENT", "RESORT", "OTHER"]).default("HOTEL"),
  address: z.string().optional(),
  city: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  bookingRef: z.string().optional(),
  confirmationUrl: z.string().url().optional().or(z.literal("")),
  price: z.string().optional(),
  pricePerNight: z.string().optional(),
  notes: z.string().optional(),
});

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createAccommodation(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = accommodationSchema.parse(Object.fromEntries(formData));

  await prisma.accommodation.create({
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

  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function updateAccommodation(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = accommodationSchema.parse(Object.fromEntries(formData));

  await prisma.accommodation.update({
    where: { id },
    data: {
      ...data,
      checkIn: new Date(data.checkIn),
      checkOut: new Date(data.checkOut),
      price: data.price ? parseFloat(data.price) : null,
      pricePerNight: data.pricePerNight ? parseFloat(data.pricePerNight) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function deleteAccommodation(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.accommodation.delete({ where: { id } });
  revalidatePath(`/trips/${tripId}/accommodations`);
}
