"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMediaConfig } from "@/lib/media-config";
import { ManifestError, scanMediaLibrary } from "@/lib/media-library";
import { setDiveClipLinks, type ClipLinkChange } from "@/lib/services/dive-media";
import { NotFoundError } from "@/lib/services/errors";
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
        update: {
          itemId: clip.itemId,
          kind: clip.kind,
          capturedAt: clip.capturedAt,
          sizeBytes: clip.sizeBytes,
        },
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

export async function setClipLinks(diveLogId: string, changes: readonly ClipLinkChange[]) {
  // Not webActor(): the media actions check isAdmin and not the status, as always.
  const userId = await requireMediaOwner();
  try {
    await setDiveClipLinks({ kind: "web", userId }, diveLogId, changes);
  } catch (error) {
    if (error instanceof NotFoundError) redirect("/dives");
    throw error;
  }
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
