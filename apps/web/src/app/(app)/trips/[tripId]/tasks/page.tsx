import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TasksList } from "@/components/tasks/tasks-list";
import { PendingBookings } from "@/components/tasks/pending-bookings";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { ClipboardList } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function TasksPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tasks: { orderBy: { createdAt: "asc" } },
        flights: { select: { id: true, airline: true, flightNumber: true, origin: true, destination: true, bookingRef: true } },
        accommodations: { select: { id: true, name: true, city: true, bookingRef: true } },
        activities: { select: { id: true, name: true, status: true } },
      },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session.user.id) notFound();
  const counts = await getTripNavCounts(tripId);

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.tasks}
        tripsLabel={t.trips}
        icon={<ClipboardList className="h-5 w-5" />}
        counts={counts}
      />
      <PendingBookings
        tripId={trip.id}
        flights={trip.flights}
        accommodations={trip.accommodations}
        activities={trip.activities}
      />
      <TasksList tripId={trip.id} tasks={trip.tasks} />
    </div>
  );
}
