import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentsList } from "@/components/documents/documents-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { FileText } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DocumentsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { documents: { orderBy: { createdAt: "asc" } } },
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
        title={t.documents}
        tripsLabel={t.trips}
        icon={<FileText className="h-5 w-5" />}
        counts={counts}
      />
      <DocumentsList tripId={trip.id} documents={trip.documents} />
    </div>
  );
}
