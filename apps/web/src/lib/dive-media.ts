import "server-only";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getMediaConfig } from "@/lib/media-config";
import { jellyfinDetailsUrl, jellyfinItemId, jellyfinPrimaryImageUrl } from "@/lib/jellyfin";
import { dateToDayKey, dayKey, dayKeyToDate, matchClipsToDive } from "@/lib/media-match";

export type DiveClip = {
  readonly id: string;
  readonly filename: string;
  readonly capturedAt: Date;
  readonly kind: "VIDEO" | "PHOTO";
  // Lo que dice el emparejamiento por hora, antes de overrides. El selector lo
  // necesita para saber si guardar un override explícito o borrar el que haya.
  readonly auto: boolean;
  readonly attached: boolean;
  readonly detailsUrls: readonly string[];
  readonly imageUrls: readonly string[];
};

export type DiveMedia = {
  readonly clips: readonly DiveClip[];
  readonly day: string;
  readonly offsetMinutes: number;
  readonly offsetSource: "AUTO" | "MANUAL" | null;
  readonly jellyfinUrls: readonly string[];
};

// Los clips del día ±1 son el conjunto entre el que elegir a mano cuando el
// desfase de reloj impide que el automático acierte.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDiveMedia(userId: string, diveLogId: string): Promise<DiveMedia | null> {
  const config = getMediaConfig();
  if (!config) return null;

  const dive = await prisma.diveLog.findFirst({
    where: { id: diveLogId, userId },
    select: { id: true, date: true, bottomTime: true },
  });
  if (!dive) return null;

  const day = dayKey(dive.date);
  const [clips, offset, links] = await Promise.all([
    prisma.mediaClip.findMany({
      where: {
        userId,
        capturedAt: {
          gte: new Date(dive.date.getTime() - DAY_MS),
          lte: new Date(dive.date.getTime() + DAY_MS),
        },
      },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.dayClockOffset.findUnique({
      where: { userId_day: { userId, day: dayKeyToDate(day) } },
      select: { offsetMinutes: true, source: true },
    }),
    prisma.mediaClipLink.findMany({ where: { diveLogId }, select: { clipId: true, included: true } }),
  ]);

  const overrides = new Map(links.map((link) => [link.clipId, link.included]));
  const offsetMinutes = offset?.offsetMinutes ?? 0;
  const auto = new Set(matchClipsToDive(dive, clips, offsetMinutes, new Map()).map((clip) => clip.id));
  const attached = new Set(matchClipsToDive(dive, clips, offsetMinutes, overrides).map((clip) => clip.id));
  // Links e imágenes necesitan orden inverso, y la razón es la cookie de sesión.
  // Un link es navegación de primer nivel y sí arrastra la cookie SameSite=Lax
  // de Authentik, así que el host interno funciona. Una miniatura es un
  // subrecurso cross-site y no la arrastra: contra el host interno cae siempre
  // en el login de Authentik. El público no tiene forward-auth y el endpoint de
  // imagen de Jellyfin es anónimo (ImageController.GetItemImage no lleva
  // [Authorize]), así que es el único que sirve miniaturas desde otro origen.
  const linkBases = [config.internalUrl, config.publicUrl].filter((url) => url !== null);
  const imageBases = [config.publicUrl, config.internalUrl].filter((url) => url !== null);

  return {
    clips: clips.map((clip) => {
      const itemId = jellyfinItemId(path.posix.join(config.jellyfinLibraryPath, clip.path), clip.kind);
      return {
        id: clip.id,
        filename: clip.path,
        capturedAt: clip.capturedAt,
        kind: clip.kind,
        auto: auto.has(clip.id),
        attached: attached.has(clip.id),
        detailsUrls: linkBases.map((base) => jellyfinDetailsUrl(base, itemId)),
        imageUrls: imageBases.map((base) => jellyfinPrimaryImageUrl(base, itemId)),
      };
    }),
    day,
    offsetMinutes,
    offsetSource: offset?.source ?? null,
    jellyfinUrls: linkBases,
  };
}

// Recuento de clips por inmersión para la lista. Se resuelve de una vez para
// todas: son las mismas tres tablas y el emparejamiento es en memoria, así que
// una query por fila no compraría nada.
export async function getDiveClipCounts(userId: string): Promise<ReadonlyMap<string, number>> {
  if (!getMediaConfig()) return new Map();

  const [clips, dives, offsets, links] = await Promise.all([
    prisma.mediaClip.findMany({ where: { userId }, select: { id: true, capturedAt: true } }),
    prisma.diveLog.findMany({ where: { userId }, select: { id: true, date: true, bottomTime: true } }),
    prisma.dayClockOffset.findMany({ where: { userId }, select: { day: true, offsetMinutes: true } }),
    prisma.mediaClipLink.findMany({
      where: { diveLog: { userId } },
      select: { clipId: true, diveLogId: true, included: true },
    }),
  ]);
  if (clips.length === 0) return new Map();

  const offsetByDay = new Map(offsets.map((offset) => [dateToDayKey(offset.day), offset.offsetMinutes]));
  const overridesByDive = new Map<string, Map<string, boolean>>();
  for (const link of links) {
    const existing = overridesByDive.get(link.diveLogId) ?? new Map<string, boolean>();
    existing.set(link.clipId, link.included);
    overridesByDive.set(link.diveLogId, existing);
  }

  const counts = new Map<string, number>();
  for (const dive of dives) {
    const offsetMinutes = offsetByDay.get(dayKey(dive.date)) ?? 0;
    const overrides = overridesByDive.get(dive.id) ?? new Map<string, boolean>();
    const matched = matchClipsToDive(dive, clips, offsetMinutes, overrides).length;
    if (matched > 0) counts.set(dive.id, matched);
  }
  return counts;
}

export type LibraryDay = {
  readonly day: string;
  readonly offsetMinutes: number;
  readonly offsetSource: "AUTO" | "MANUAL" | null;
  readonly clips: readonly (DiveClip & { readonly diveNumber: number | null; readonly diveLogId: string | null })[];
};

// Vista global: todos los clips indexados agrupados por día, con la inmersión
// que reclama cada uno. Es la pantalla donde se ve de un vistazo qué días tienen
// el desfase mal puesto y qué clips no los recoge nadie.
export async function getMediaLibrary(userId: string): Promise<readonly LibraryDay[] | null> {
  const config = getMediaConfig();
  if (!config) return null;

  const [clips, dives, offsets, links] = await Promise.all([
    prisma.mediaClip.findMany({ where: { userId }, orderBy: { capturedAt: "asc" } }),
    prisma.diveLog.findMany({
      where: { userId },
      select: { id: true, date: true, bottomTime: true, diveNumber: true },
    }),
    prisma.dayClockOffset.findMany({ where: { userId } }),
    prisma.mediaClipLink.findMany({
      where: { diveLog: { userId } },
      select: { clipId: true, diveLogId: true, included: true },
    }),
  ]);

  const offsetByDay = new Map(offsets.map((offset) => [dateToDayKey(offset.day), offset]));
  const overridesByDive = new Map<string, Map<string, boolean>>();
  for (const link of links) {
    const existing = overridesByDive.get(link.diveLogId) ?? new Map<string, boolean>();
    existing.set(link.clipId, link.included);
    overridesByDive.set(link.diveLogId, existing);
  }

  const claimedBy = new Map<string, { id: string; diveNumber: number }>();
  for (const dive of dives) {
    const offsetMinutes = offsetByDay.get(dayKey(dive.date))?.offsetMinutes ?? 0;
    const overrides = overridesByDive.get(dive.id) ?? new Map<string, boolean>();
    for (const clip of matchClipsToDive(dive, clips, offsetMinutes, overrides)) {
      claimedBy.set(clip.id, { id: dive.id, diveNumber: dive.diveNumber });
    }
  }

  const linkBases = [config.internalUrl, config.publicUrl].filter((url) => url !== null);
  const imageBases = [config.publicUrl, config.internalUrl].filter((url) => url !== null);
  const byDay = Map.groupBy(clips, (clip) => dayKey(clip.capturedAt));

  return [...byDay]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, dayClips]) => {
      const offset = offsetByDay.get(day);
      return {
        day,
        offsetMinutes: offset?.offsetMinutes ?? 0,
        offsetSource: offset?.source ?? null,
        clips: dayClips.map((clip) => {
          const itemId = jellyfinItemId(path.posix.join(config.jellyfinLibraryPath, clip.path), clip.kind);
          const claim = claimedBy.get(clip.id);
          return {
            id: clip.id,
            filename: clip.path,
            capturedAt: clip.capturedAt,
            kind: clip.kind,
            auto: claim !== undefined,
            attached: claim !== undefined,
            diveNumber: claim?.diveNumber ?? null,
            diveLogId: claim?.id ?? null,
            detailsUrls: linkBases.map((base) => jellyfinDetailsUrl(base, itemId)),
            imageUrls: imageBases.map((base) => jellyfinPrimaryImageUrl(base, itemId)),
          };
        }),
      };
    });
}
