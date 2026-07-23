import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivitiesList } from "@/components/activities/activities-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { Star } from "lucide-react";

export default async function ActivitiesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { activities: { orderBy: { scheduledAt: "asc" } } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();
  const counts = await getTripNavCounts(tripId);

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Actividades" icon={<Star className="h-5 w-5" />} counts={counts} />
      <ActivitiesList tripId={trip.id} activities={trip.activities} tripStartDate={trip.startDate} />
    </div>
  );
}
