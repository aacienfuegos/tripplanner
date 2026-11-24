import "server-only";
import { revalidatePath } from "next/cache";
import { documentInputSchema, type DocumentInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { auditedCreate, auditedDelete, auditedUpdate } from "@/lib/services/audit";

export async function createDocument(actor: Actor, tripId: string, input: DocumentInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(documentInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Document", tripId }, (db, mark) =>
    db.document.create({ data: { ...data, ...mark, tripId, expiresAt: toDate(data.expiresAt) } }),
  );
  revalidatePath(`/trips/${tripId}/documents`);
  return created;
}

export async function updateDocument(actor: Actor, tripId: string, id: string, input: Partial<DocumentInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(documentInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Document", tripId, id },
    (db) => db.document.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Document",
        db.document.update({ where: { id, tripId }, data: { ...data, ...mark, expiresAt: toDate(data.expiresAt) } }),
      ),
  );
  revalidatePath(`/trips/${tripId}/documents`);
}

export async function deleteDocument(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await auditedDelete(actor, { entity: "Document", tripId, id }, (db) =>
    orNotFound("Document", db.document.delete({ where: { id, tripId } })),
  );
  revalidatePath(`/trips/${tripId}/documents`);
}
