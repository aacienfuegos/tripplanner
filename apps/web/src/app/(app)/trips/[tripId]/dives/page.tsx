import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripDiveSection } from "@/components/dives/trip-dive-section";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { Waves } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function TripDivesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { diveLogs: { include: { diveSite: true, equipment: true }, orderBy: { date: "desc" } } },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session!.user!.id) notFound();

  const userId = session!.user!.id;
  const [counts, availableDives, sites, equipment] = await Promise.all([
    getTripNavCounts(tripId),
    prisma.diveLog.findMany({
      where: { userId, OR: [{ tripId: null }, { tripId: { not: tripId } }] },
      include: { diveSite: true, equipment: true },
      orderBy: { date: "desc" },
    }),
    prisma.diveSite.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.diveEquipment.findMany({ where: { userId, status: "OWNED" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.sectionDives}
        tripsLabel={t.trips}
        icon={<Waves className="h-5 w-5" />}
        counts={counts}
      />
      <TripDiveSection
        tripId={trip.id}
        dives={trip.diveLogs}
        availableDives={availableDives}
        sites={sites}
        equipment={equipment}
      />
    </div>
  );
}
