import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripForm } from "@/components/trips/trip-form";
import { getT } from "@/lib/locale";

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const [session, t, trip] = await Promise.all([
    auth(),
    getT(),
    prisma.trip.findUnique({ where: { id: tripId } }),
  ]);
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.editTrip}</h1>
      <TripForm trip={trip} />
    </div>
  );
}
