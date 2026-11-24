import "server-only";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { NotFoundError } from "@/lib/services/errors";

// What the agents read of the trips. Every query carries its owner: the user
// in the trip list, the trip (already checked) in its sections.

export const SECTION_LIMIT = 500;

export type Page = { readonly cursor?: string; readonly limit: number };

// One more than the page, so the caller knows whether there is a next one.
export function listTrips(actor: Actor, { cursor, limit }: Page) {
  const reach = actor.kind === "agent" && !actor.grant.allTrips ? { in: [...actor.grant.tripIds] } : {};
  const after = cursor ? { gt: cursor } : {};
  const id = { ...reach, ...after };
  return prisma.trip.findMany({
    where: { userId: actor.userId, ...(Object.keys(id).length > 0 ? { id } : {}) },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
}

export async function getTrip(actor: Actor, tripId: string) {
  await requireTrip(actor, tripId);
  const trip = await prisma.trip.findUnique({ where: { id: tripId, userId: actor.userId } });
  if (!trip) throw new NotFoundError("Trip");

  const take = SECTION_LIMIT + 1;
  const where = { tripId };
  const [destinations, flights, accommodations, activities, documents, expenses, tasks, packingItems, dives] =
    await Promise.all([
      prisma.destination.findMany({ where, orderBy: { order: "asc" }, take }),
      prisma.flight.findMany({ where, orderBy: { departureAt: "asc" }, take }),
      prisma.accommodation.findMany({ where, orderBy: { checkIn: "asc" }, take }),
      prisma.activity.findMany({ where, orderBy: { scheduledAt: "asc" }, take }),
      prisma.document.findMany({ where, orderBy: { createdAt: "asc" }, take }),
      prisma.expense.findMany({ where, orderBy: { date: "asc" }, take }),
      prisma.task.findMany({ where, orderBy: { createdAt: "asc" }, take }),
      prisma.packingItem.findMany({ where, orderBy: { id: "asc" }, take }),
      // The summary of its dives: date, site, depth and time.
      prisma.diveLog.findMany({
        where: { tripId, userId: actor.userId },
        orderBy: { date: "asc" },
        take,
        select: {
          id: true,
          diveNumber: true,
          date: true,
          depthMax: true,
          bottomTime: true,
          diveSite: { select: { id: true, name: true } },
        },
      }),
    ]);
  const sections = { destinations, flights, accommodations, activities, documents, expenses, tasks, packingItems, dives };
  const truncated = Object.entries(sections)
    .filter(([, rows]) => rows.length > SECTION_LIMIT)
    .map(([name]) => name);
  return {
    trip,
    truncated,
    sections: {
      destinations: destinations.slice(0, SECTION_LIMIT),
      flights: flights.slice(0, SECTION_LIMIT),
      accommodations: accommodations.slice(0, SECTION_LIMIT),
      activities: activities.slice(0, SECTION_LIMIT),
      documents: documents.slice(0, SECTION_LIMIT),
      expenses: expenses.slice(0, SECTION_LIMIT),
      tasks: tasks.slice(0, SECTION_LIMIT),
      packingItems: packingItems.slice(0, SECTION_LIMIT),
      dives: dives.slice(0, SECTION_LIMIT),
    },
  };
}
