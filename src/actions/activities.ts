"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const activitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["ACTIVITY", "RESTAURANT", "MUSEUM", "TOUR", "TRANSPORT", "SHOW", "OTHER"]).default("ACTIVITY"),
  description: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  scheduledAt: z.string().optional(),
  duration: z.string().optional(),
  bookingRef: z.string().optional(),
  confirmationUrl: z.string().url().optional().or(z.literal("")),
  price: z.string().optional(),
  status: z.enum(["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"]).default("PENDING"),
  notes: z.string().optional(),
});

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createActivity(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = activitySchema.parse(Object.fromEntries(formData));

  await prisma.activity.create({
    data: {
      tripId,
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      duration: data.duration ? parseInt(data.duration) : null,
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivity(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = activitySchema.parse(Object.fromEntries(formData));

  await prisma.activity.update({
    where: { id },
    data: {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      duration: data.duration ? parseInt(data.duration) : null,
      price: data.price ? parseFloat(data.price) : null,
      confirmationUrl: data.confirmationUrl || null,
    },
  });

  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivityStatus(tripId: string, id: string, status: string) {
  await requireTripOwner(tripId);
  await prisma.activity.update({ where: { id }, data: { status: status as any } });
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function deleteActivity(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.activity.delete({ where: { id } });
  revalidatePath(`/trips/${tripId}/activities`);
}
