import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivitiesList } from "@/components/activities/activities-list";
import { SectionHeader } from "@/components/layout/section-header";
import { Star } from "lucide-react";

export default async function ActivitiesPage({ params }: { params: { tripId: string } }) {
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { activities: { orderBy: { scheduledAt: "asc" } } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Actividades" icon={<Star className="h-5 w-5" />} />
      <ActivitiesList tripId={trip.id} activities={trip.activities} />
    </div>
  );
}
