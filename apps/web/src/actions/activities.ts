"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { activitySchema } from "@/lib/schemas";
import { geocodeActivity } from "@/lib/geocode-items";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createActivity(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = activitySchema.parse(Object.fromEntries(formData));

  const created = await prisma.activity.create({
    data: {
      tripId,
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      duration: data.duration ? parseInt(data.duration) : null,
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  void geocodeActivity(created.id);
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivity(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = activitySchema.parse(Object.fromEntries(formData));

  await prisma.activity.update({
    where: { id, tripId },
    data: {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      duration: data.duration ? parseInt(data.duration) : null,
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
      latitude: null,
      longitude: null,
    },
  });

  void geocodeActivity(id);
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivityStatus(tripId: string, id: string, status: string) {
  await requireTripOwner(tripId);
  const parsed = activitySchema.shape.status.parse(status);
  await prisma.activity.update({ where: { id, tripId }, data: { status: parsed } });
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function deleteActivity(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.activity.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/activities`);
}
