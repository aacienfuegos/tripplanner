import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TasksList } from "@/components/tasks/tasks-list";
import { SectionHeader } from "@/components/layout/section-header";
import { ClipboardList } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function TasksPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { tasks: { orderBy: { createdAt: "asc" } } },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session.user.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.tasks}
        tripsLabel={t.trips}
        icon={<ClipboardList className="h-5 w-5" />}
      />
      <TasksList tripId={trip.id} tasks={trip.tasks} />
    </div>
  );
}
