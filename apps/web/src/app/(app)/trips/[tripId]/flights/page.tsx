import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlightsList } from "@/components/flights/flights-list";
import { SectionHeader } from "@/components/layout/section-header";
import { Plane } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function FlightsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { flights: { orderBy: { departureAt: "asc" } } },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.flights}
        tripsLabel={t.trips}
        icon={<Plane className="h-5 w-5" />}
      />
      <FlightsList tripId={trip.id} flights={trip.flights} tripStartDate={trip.startDate} />
    </div>
  );
}
