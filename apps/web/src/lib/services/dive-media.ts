import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/services/actor";
import { NotFoundError } from "@/lib/services/errors";

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

  await prisma.$transaction([
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
