import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { documentInputSchema, type DocumentInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";

export async function createDocument(actor: Actor, tripId: string, input: DocumentInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(documentInputSchema, input);
  const created = await prisma.document.create({ data: { ...data, tripId, expiresAt: toDate(data.expiresAt) } });
  revalidatePath(`/trips/${tripId}/documents`);
  return created;
}

export async function updateDocument(actor: Actor, tripId: string, id: string, input: Partial<DocumentInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(documentInputSchema.partial(), input);
  await orNotFound(
    "Document",
    prisma.document.update({ where: { id, tripId }, data: { ...data, expiresAt: toDate(data.expiresAt) } }),
  );
  revalidatePath(`/trips/${tripId}/documents`);
}

export async function deleteDocument(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Document", prisma.document.delete({ where: { id, tripId } }));
  revalidatePath(`/trips/${tripId}/documents`);
}
