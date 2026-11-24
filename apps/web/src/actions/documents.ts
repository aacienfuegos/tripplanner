"use server";

import { documentSchema } from "@/lib/schemas";
import type { DocumentInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as documents from "@/lib/services/documents";

function toInput(formData: FormData): DocumentInput {
  const data = documentSchema.parse(Object.fromEntries(formData));
  return { ...data, fileUrl: data.fileUrl || null, expiresAt: data.expiresAt || null };
}

export async function createDocument(tripId: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(documents.createDocument(actor, tripId, toInput(formData)));
}

export async function updateDocument(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  await redirectIfTripNotFound(documents.updateDocument(actor, tripId, id, toInput(formData)));
}

export async function deleteDocument(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(documents.deleteDocument(actor, tripId, id));
}
