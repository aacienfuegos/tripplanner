"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMediaConfig } from "@/lib/media-config";
import { ManifestError, scanMediaLibrary } from "@/lib/media-library";
import {
  clipsNearDives,
  dateToDayKey,
  dayKey,
  dayKeyToDate,
  deduceSiteOffset,
  groupIntoTrips,
} from "@/lib/media-match";

async function requireMediaOwner(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  // La biblioteca es una sola, la del servidor: solo el admin la ve (#311).
  if (!user?.isAdmin) redirect("/dives");
  return session.user.id;
}

export type ScanResult = { indexed: number; removed: number } | { error: string };

export async function rescanMediaLibrary(): Promise<ScanResult> {
  const userId = await requireMediaOwner();
  const config = getMediaConfig();
  if (!config) return { error: "unconfigured" };

  let clips;
  try {
    clips = await scanMediaLibrary(config.libraryPath, config.jellyfinLibraryPath);
  } catch (error) {
    if (error instanceof ManifestError) return { error: error.code };
    // El disco es LUKS: si no está montado el bind aparece vacío o ilegible.
    // Borrar el índice ahí dejaría al usuario sin vídeos por un fallo de arranque.
    return { error: "unreachable" };
  }
  if (clips.length === 0) return { error: "empty" };

  const removed = await prisma.mediaClip.deleteMany({
    where: { userId, path: { notIn: clips.map((clip) => clip.path) } },
  });
  await prisma.$transaction(
    clips.map((clip) =>
      prisma.mediaClip.upsert({
        where: { userId_path: { userId, path: clip.path } },
        create: { userId, ...clip },
        update: { kind: clip.kind, capturedAt: clip.capturedAt, sizeBytes: clip.sizeBytes },
      }),
    ),
  );

  await refreshSiteOffsets(userId);
  revalidatePath("/dives");
  return { indexed: clips.length, removed: removed.count };
}

async function refreshSiteOffsets(userId: string) {
  const [clips, dives, manual] = await Promise.all([
    prisma.mediaClip.findMany({ where: { userId }, select: { id: true, capturedAt: true } }),
    prisma.diveLog.findMany({ where: { userId }, select: { id: true, date: true, bottomTime: true } }),
    prisma.mediaSiteOffset.findMany({ where: { userId, source: "MANUAL" }, select: { day: true } }),
  ]);

  const untouchable = new Set(manual.map((offset) => dateToDayKey(offset.day)));
  const divesByDay = Map.groupBy(dives, (dive) => dayKey(dive.date));

  for (const run of groupIntoTrips([...divesByDay.keys()])) {
    const runDives = run.flatMap((day) => divesByDay.get(day) ?? []);
    const offsetMinutes = deduceSiteOffset(clipsNearDives(clips, runDives), runDives);
    if (offsetMinutes === null) continue;
    for (const day of run) {
      if (untouchable.has(day)) continue;
      const date = dayKeyToDate(day);
      await prisma.mediaSiteOffset.upsert({
        where: { userId_day: { userId, day: date } },
        create: { userId, day: date, offsetMinutes, source: "AUTO" },
        update: { offsetMinutes, source: "AUTO" },
      });
    }
  }
}

// `included: null` borra el override y devuelve el clip al automático. Se
// aplican en bloque: el selector deja hacer decenas de cambios antes de guardar
// y una action por clip repintaría la ficha entera entre medias.
export type ClipLinkChange = { readonly clipId: string; readonly included: boolean | null };

export async function setClipLinks(diveLogId: string, changes: readonly ClipLinkChange[]) {
  const userId = await requireMediaOwner();
  const dive = await prisma.diveLog.findFirst({ where: { id: diveLogId, userId }, select: { id: true } });
  if (!dive) redirect("/dives");

  const owned = await prisma.mediaClip.findMany({
    where: { userId, id: { in: changes.map((change) => change.clipId) } },
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

export async function setDaySiteOffset(day: string, offsetMinutes: number) {
  const userId = await requireMediaOwner();
  const date = dayKeyToDate(day);
  await prisma.mediaSiteOffset.upsert({
    where: { userId_day: { userId, day: date } },
    create: { userId, day: date, offsetMinutes, source: "MANUAL" },
    update: { offsetMinutes, source: "MANUAL" },
  });
  revalidatePath("/dives");
}
