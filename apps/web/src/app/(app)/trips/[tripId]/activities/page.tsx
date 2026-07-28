import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivitiesList } from "@/components/activities/activities-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { Star } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function ActivitiesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { activities: { orderBy: { scheduledAt: "asc" } } },
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
        title={t.activities}
        tripsLabel={t.trips}
        icon={<Star className="h-5 w-5" />}
        counts={counts}
      />
      <ActivitiesList tripId={trip.id} activities={trip.activities} tripStartDate={trip.startDate} currency={trip.currency} />
    </div>
  );
}
