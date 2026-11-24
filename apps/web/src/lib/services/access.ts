import "server-only";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/services/actor";
import { NotFoundError, type Entity } from "@/lib/services/errors";

// Ownership checks of the service layer. Every lookup carries the owner in its
// where, and the owner is always the actor's: never one that comes in the
// input. The elements of a trip are then written with `{ id, tripId }`, so the
// check is per element and not only per trip.

// An agent only reaches the trips of its connection: all of them, or the list.
export function canReachTrip(actor: Actor, tripId: string): boolean {
  return actor.kind === "web" || actor.grant.allTrips || actor.grant.tripIds.has(tripId);
}

export async function requireTrip(actor: Actor, tripId: string): Promise<{ id: string; currency: string }> {
  if (!canReachTrip(actor, tripId)) throw new NotFoundError("Trip");
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: actor.userId },
    select: { userId: true, currency: true },
  });
  if (!trip || trip.userId !== actor.userId) throw new NotFoundError("Trip");
  return { id: tripId, currency: trip.currency };
}

// A suitcase id sent with a trip has to be one of that trip's bags.
export async function requireSuitcase(tripId: string, suitcaseId: string | null): Promise<void> {
  if (suitcaseId === null) return;
  const suitcase = await prisma.suitcase.findFirst({ where: { id: suitcaseId, tripId }, select: { id: true } });
  if (!suitcase) throw new NotFoundError("Suitcase");
}

// ─── Diving ───────────────────────────────────────────────────────────────────
// References that come in a dive, site or service input. The web keeps what it
// always did: an id that isn't the user's is dropped (stored as null). An agent
// gets NotFoundError instead, before anything is written.

async function resolveReference(
  actor: Actor,
  id: string | null | undefined,
  entity: Entity,
  isOwned: (id: string) => Promise<boolean>,
): Promise<string | null> {
  if (!id) return null;
  if (await isOwned(id)) return id;
  if (actor.kind === "agent") throw new NotFoundError(entity);
  return null;
}

export function resolveDiveSiteId(actor: Actor, id: string | null | undefined): Promise<string | null> {
  return resolveReference(actor, id, "Dive site", async (siteId) => {
    const site = await prisma.diveSite.findUnique({
      where: { id: siteId, userId: actor.userId },
      select: { userId: true },
    });
    return site?.userId === actor.userId;
  });
}

export function resolveDiveAreaId(actor: Actor, id: string | null | undefined): Promise<string | null> {
  return resolveReference(actor, id, "Dive area", async (areaId) => {
    const area = await prisma.diveArea.findUnique({
      where: { id: areaId, userId: actor.userId },
      select: { userId: true },
    });
    return area?.userId === actor.userId;
  });
}

// The trip list of a connection doesn't limit diving, but it does limit every
// trip a dive is linked to: for an agent the trip goes through requireTrip.
export async function resolveDiveTripId(actor: Actor, tripId: string | null | undefined): Promise<string | null> {
  if (!tripId) return null;
  if (actor.kind === "agent") {
    await requireTrip(actor, tripId);
    return tripId;
  }
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: actor.userId },
    select: { userId: true },
  });
  return trip?.userId === actor.userId ? tripId : null;
}

export async function resolveEquipmentIds(actor: Actor, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const owned = await prisma.diveEquipment.findMany({
    where: { id: { in: [...ids] }, userId: actor.userId },
    select: { id: true },
  });
  if (actor.kind === "agent" && owned.length !== new Set(ids).size) throw new NotFoundError("Equipment");
  return owned.map((e) => e.id);
}

export async function requireEquipment(actor: Actor, equipmentId: string): Promise<void> {
  const equipment = await prisma.diveEquipment.findUnique({
    where: { id: equipmentId, userId: actor.userId },
    select: { id: true },
  });
  if (!equipment) throw new NotFoundError("Equipment");
}
