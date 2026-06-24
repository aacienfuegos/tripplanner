import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccommodationsList } from "@/components/accommodations/accommodations-list";
import { SectionHeader } from "@/components/layout/section-header";
import { Hotel } from "lucide-react";

export default async function AccommodationsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { accommodations: { orderBy: { checkIn: "asc" } } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Alojamiento" icon={<Hotel className="h-5 w-5" />} />
      <AccommodationsList tripId={trip.id} accommodations={trip.accommodations} tripStartDate={trip.startDate} />
    </div>
  );
}
