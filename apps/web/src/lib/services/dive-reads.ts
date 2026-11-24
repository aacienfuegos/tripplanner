import "server-only";
import { prisma } from "@/lib/prisma";
import { computeDiveStats } from "@/lib/dive-stats";
import { getDiveMedia } from "@/lib/dive-media";
import type { Actor } from "@/lib/services/actor";
import { canReachTrip, requireTrip } from "@/lib/services/access";
import { NotFoundError } from "@/lib/services/errors";
import type { Page } from "@/lib/services/trip-reads";

// What the agents read of the logbook, always with `{ userId }`. The trip list
// of a connection doesn't limit diving, but of a trip outside it a dive only
// shows the opaque tripId: no name, no dates.

const DAY_MS = 24 * 60 * 60 * 1000;

export type DiveFilter = Page & { readonly tripId?: string; readonly from?: string; readonly to?: string };

// The names of the dives' trips that the actor reaches.
async function reachableTripNames(actor: Actor, tripIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(tripIds.filter((id): id is string => id !== null && canReachTrip(actor, id)))];
  if (ids.length === 0) return new Map();
  const trips = await prisma.trip.findMany({ where: { id: { in: ids }, userId: actor.userId }, select: { id: true, name: true } });
  return new Map(trips.map((trip) => [trip.id, trip.name]));
}

export async function listDives(actor: Actor, { tripId, from, to, cursor, limit }: DiveFilter) {
  if (tripId) await requireTrip(actor, tripId);
  const date = {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to}T00:00:00`).getTime() + DAY_MS) } : {}),
  };
  const dives = await prisma.diveLog.findMany({
    where: {
      userId: actor.userId,
      ...(tripId ? { tripId } : {}),
      ...(Object.keys(date).length > 0 ? { date } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  return { dives, tripNames: await reachableTripNames(actor, dives.map((dive) => dive.tripId)) };
}

export async function getDive(actor: Actor, id: string) {
  const dive = await prisma.diveLog.findUnique({
    where: { id, userId: actor.userId },
    include: { diveSite: { select: { id: true, name: true } }, equipment: { select: { id: true, name: true } } },
  });
  if (!dive) throw new NotFoundError("Dive");
  return { dive, tripNames: await reachableTripNames(actor, [dive.tripId]) };
}

export async function getDiveProfile(actor: Actor, id: string) {
  const dive = await prisma.diveLog.findUnique({ where: { id, userId: actor.userId }, select: { id: true } });
  if (!dive) throw new NotFoundError("Dive");
  return prisma.diveProfileSample.findMany({
    where: { diveLogId: dive.id },
    orderBy: { seconds: "asc" },
    select: { seconds: true, depth: true, temp: true, ndlMinutes: true },
  });
}

export async function listDiveSites(actor: Actor) {
  const [sites, areas] = await Promise.all([
    prisma.diveSite.findMany({ where: { userId: actor.userId }, orderBy: { name: "asc" } }),
    prisma.diveArea.findMany({ where: { userId: actor.userId }, select: { id: true, name: true } }),
  ]);
  return { sites, areaNames: new Map(areas.map((area) => [area.id, area.name])) };
}

export function listDiveAreas(actor: Actor) {
  return prisma.diveArea.findMany({ where: { userId: actor.userId }, orderBy: { name: "asc" } });
}

export async function listEquipment(actor: Actor) {
  const [equipment, services] = await Promise.all([
    prisma.diveEquipment.findMany({ where: { userId: actor.userId }, orderBy: { name: "asc" } }),
    prisma.diveEquipmentService.findMany({ where: { userId: actor.userId }, orderBy: { date: "asc" } }),
  ]);
  return equipment.map((item) => ({ ...item, services: services.filter((s) => s.equipmentId === item.id) }));
}

export function listCertifications(actor: Actor) {
  return prisma.diveCertification.findMany({ where: { userId: actor.userId }, orderBy: { issueDate: "asc" } });
}

export async function getDiveStats(actor: Actor) {
  const dives = await prisma.diveLog.findMany({
    where: { userId: actor.userId },
    select: {
      depthMax: true,
      bottomTime: true,
      waterTemp: true,
      date: true,
      diveSite: { select: { id: true, name: true, country: true } },
    },
  });
  return computeDiveStats(dives);
}

// getDiveMedia already reads isAdmin again and filters by the user.
export async function listDiveMedia(actor: Actor, diveId: string) {
  const media = await getDiveMedia(actor.userId, diveId);
  if (!media) throw new NotFoundError("Dive");
  return media;
}
