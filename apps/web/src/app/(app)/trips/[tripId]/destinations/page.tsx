import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DestinationList } from "@/components/trips/destination-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { MapPin } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DestinationsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { destinations: { orderBy: { order: "asc" } } },
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
        title={t.destinations}
        tripsLabel={t.trips}
        icon={<MapPin className="h-5 w-5" />}
        counts={counts}
      />
      <DestinationList tripId={trip.id} destinations={trip.destinations} tripStartDate={trip.startDate} />
    </div>
  );
}
