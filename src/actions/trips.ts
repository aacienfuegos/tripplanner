"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripSchema, tripStatusSchema } from "@/lib/schemas";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  return session.user.id;
}

export async function createTrip(formData: FormData) {
  const userId = await requireUser();
  const raw = Object.fromEntries(formData);
  const data = tripSchema.parse(raw);

  const trip = await prisma.trip.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      currency: data.currency,
      budget: data.budget ? parseFloat(data.budget) : null,
      coverImage: data.coverImage,
    },
  });

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  const userId = await requireUser();
  await assertTripOwner(tripId, userId);

  const raw = Object.fromEntries(formData);
  const data = tripSchema.parse(raw);

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      name: data.name,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      currency: data.currency,
      budget: data.budget ? parseFloat(data.budget) : null,
      coverImage: data.coverImage,
    },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function deleteTrip(tripId: string) {
  const userId = await requireUser();
  await assertTripOwner(tripId, userId);

  await prisma.trip.delete({ where: { id: tripId } });
  revalidatePath("/trips");
  redirect("/trips");
}

export async function updateTripStatus(tripId: string, status: string) {
  const userId = await requireUser();
  await assertTripOwner(tripId, userId);
  const parsed = tripStatusSchema.parse(status);

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: parsed },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

async function assertTripOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== userId) redirect("/trips");
}
