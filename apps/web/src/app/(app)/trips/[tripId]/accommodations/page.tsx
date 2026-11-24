import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccommodationsList } from "@/components/accommodations/accommodations-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { Hotel } from "lucide-react";
import { getT } from "@/lib/locale";
import { getAgentLabels } from "@/lib/agent-labels";
import { AgentLabelsProvider } from "@/components/agents/agent-badge";
import { AgentSuggestions } from "@/components/agents/agent-suggestions";
import { getSuggestionItems } from "@/lib/suggestion-items";

export default async function AccommodationsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: { accommodations: { orderBy: { checkIn: "asc" } } },
    }),
    getT(),
  ]);
  if (!trip || trip.userId !== session!.user!.id) notFound();
  const [counts, agentLabels, suggestions] = await Promise.all([
    getTripNavCounts(tripId),
    getAgentLabels(trip.userId, trip.accommodations),
    getSuggestionItems(trip.userId, tripId, "ACCOMMODATION", t, trip.currency),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.accommodations}
        tripsLabel={t.trips}
        icon={<Hotel className="h-5 w-5" />}
        counts={counts}
      />
      <AgentSuggestions tripId={trip.id} items={suggestions} />
      <AgentLabelsProvider labels={agentLabels}>
        <AccommodationsList tripId={trip.id} accommodations={trip.accommodations} tripStartDate={trip.startDate} currency={trip.currency} />
      </AgentLabelsProvider>
    </div>
  );
}
