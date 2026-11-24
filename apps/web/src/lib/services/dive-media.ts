import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/services/actor";
import { NotFoundError } from "@/lib/services/errors";
import { auditEntryData, type AuditChanges } from "@/lib/services/audit";

// La biblioteca es una sola, la del servidor: solo el admin la ve (#311). The
// flag is read again from the database on every call, for an agent too.
async function requireMediaAdmin(actor: Actor) {
  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new NotFoundError("Media library");
}

// `included: null` borra el override y devuelve el clip al automático. Se
// aplican en bloque: el selector deja hacer decenas de cambios antes de guardar
// y una action por clip repintaría la ficha entera entre medias.
export type ClipLinkChange = { readonly clipId: string; readonly included: boolean | null };

// What an agent changes is the clip's state on this dive: included, excluded
// or automatic. The entry goes into the same transaction as the links.
async function mediaAuditData(
  actor: Extract<Actor, { kind: "agent" }>,
  diveLogId: string,
  changes: readonly ClipLinkChange[],
) {
  const stored = await prisma.mediaClipLink.findMany({
    where: { diveLogId, clipId: { in: changes.map((change) => change.clipId) } },
    select: { clipId: true, included: true },
  });
  const state = (included: boolean | null | undefined) =>
    included === true ? "included" : included === false ? "excluded" : "automatic";
  const before = new Map(stored.map((link) => [link.clipId, link.included]));
  const diff: AuditChanges = Object.fromEntries(
    changes.map((change): [string, [string, string]] => [
      `clip ${change.clipId}`,
      [state(before.get(change.clipId)), state(change.included)],
    ]),
  );
  return auditEntryData(actor, { entity: "Dive" }, diveLogId, "UPDATED", diff);
}

export async function setDiveClipLinks(actor: Actor, diveLogId: string, changes: readonly ClipLinkChange[]) {
  await requireMediaAdmin(actor);
  const dive = await prisma.diveLog.findFirst({ where: { id: diveLogId, userId: actor.userId }, select: { id: true } });
  if (!dive) throw new NotFoundError("Dive");

  const owned = await prisma.mediaClip.findMany({
    where: { userId: actor.userId, id: { in: changes.map((change) => change.clipId) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((clip) => clip.id));
  const valid = changes.filter((change) => ownedIds.has(change.clipId));
  const audit =
    actor.kind === "agent"
      ? [prisma.agentAuditEntry.create({ data: await mediaAuditData(actor, diveLogId, valid) })]
      : [];

  await prisma.$transaction([
    ...audit,
    prisma.mediaClipLink.deleteMany({
      where: {
        diveLogId,
        clipId: { in: valid.filter((change) => change.included === null).map((change) => change.clipId) },
      },
    }),
    ...valid
      .filter((change) => change.included !== null)
      .map((change) =>
        prisma.mediaClipLink.upsert({
          where: { clipId_diveLogId: { clipId: change.clipId, diveLogId } },
          create: { clipId: change.clipId, diveLogId, included: change.included! },
          update: { included: change.included! },
        }),
      ),
  ]);
  revalidatePath(`/dives/${diveLogId}`);
}
