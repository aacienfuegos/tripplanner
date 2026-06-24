import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripForm } from "@/components/trips/trip-form";

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Editar viaje</h1>
      <TripForm trip={trip} />
    </div>
  );
}
