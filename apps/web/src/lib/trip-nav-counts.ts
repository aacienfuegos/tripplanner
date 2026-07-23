import { prisma } from "@/lib/prisma";

export interface TripNavCounts {
  flights: number;
  accommodations: number;
  activities: number;
  expenses: number;
  packingItems: number;
  documents: number;
  tasks: number;
}

const EMPTY_COUNTS: TripNavCounts = {
  flights: 0,
  accommodations: 0,
  activities: 0,
  expenses: 0,
  packingItems: 0,
  documents: 0,
  tasks: 0,
};

export async function getTripNavCounts(tripId: string): Promise<TripNavCounts> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      _count: {
        select: {
          flights: true,
          accommodations: true,
          activities: true,
          expenses: true,
          packingItems: true,
          documents: true,
          tasks: true,
        },
      },
    },
  });

  if (!trip) return EMPTY_COUNTS;

  return {
    flights: trip._count.flights,
    accommodations: trip._count.accommodations,
    activities: trip._count.activities,
    expenses: trip._count.expenses,
    packingItems: trip._count.packingItems,
    documents: trip._count.documents,
    tasks: trip._count.tasks,
  };
}
