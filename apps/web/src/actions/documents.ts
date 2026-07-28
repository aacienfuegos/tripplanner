"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { documentSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";

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
    where: { id, tripId },
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
  await prisma.document.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/documents`);
}
