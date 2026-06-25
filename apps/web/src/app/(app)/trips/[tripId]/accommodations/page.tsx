import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccommodationsList } from "@/components/accommodations/accommodations-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { Hotel } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function AccommodationsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { accommodations: { orderBy: { checkIn: "asc" } } },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session!.user!.id) notFound();
  const counts = await getTripNavCounts(tripId);

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.accommodations}
        tripsLabel={t.trips}
        icon={<Hotel className="h-5 w-5" />}
        counts={counts}
      />
      <AccommodationsList tripId={trip.id} accommodations={trip.accommodations} tripStartDate={trip.startDate} />
    </div>
  );
}
