"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { documentSchema } from "@/lib/schemas";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export async function createDocument(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = documentSchema.parse(Object.fromEntries(formData));
  await prisma.document.create({
    data: {
      tripId,
      ...data,
      fileUrl: data.fileUrl || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  revalidatePath(`/trips/${tripId}/documents`);
}

export async function updateDocument(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = documentSchema.parse(Object.fromEntries(formData));
  await prisma.document.update({
    where: { id },
    data: {
      ...data,
      fileUrl: data.fileUrl || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  revalidatePath(`/trips/${tripId}/documents`);
}

export async function deleteDocument(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.document.delete({ where: { id } });
  revalidatePath(`/trips/${tripId}/documents`);
}
