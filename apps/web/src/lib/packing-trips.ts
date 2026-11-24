import { prisma } from "@/lib/prisma";

// The user's other trips with something to copy into `tripId`. `userId` must come
// from the session: it is the only owner filter.
export async function listTripsToCopyFrom(userId: string, tripId: string) {
  return prisma.trip.findMany({
    where: {
      userId,
      id: { not: tripId },
      OR: [{ packingItems: { some: {} } }, { suitcases: { some: {} } }],
    },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });
}
