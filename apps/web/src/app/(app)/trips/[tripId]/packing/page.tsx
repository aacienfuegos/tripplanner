import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackingList, type PackingView } from "@/components/packing/packing-list";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { listTripsToCopyFrom } from "@/lib/packing-trips";
import { ShoppingBag } from "lucide-react";
import { getT } from "@/lib/locale";
import { getAgentLabels } from "@/lib/agent-labels";
import { AgentLabelsProvider } from "@/components/agents/agent-badge";

export default async function PackingPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;
  const [trip, t, cookieStore] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        packingItems: { orderBy: [{ category: "asc" }, { name: "asc" }] },
        suitcases: { orderBy: { createdAt: "asc" } },
      },
    }),
    getT(),
    cookies(),
  ]);
  if (!trip || trip.userId !== userId) notFound();
  const [counts, ownedEquipmentCount, user, tripsToCopy, agentLabels] = await Promise.all([
    getTripNavCounts(tripId),
    prisma.diveEquipment.count({ where: { userId, status: "OWNED" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { unitSystem: true } }),
    listTripsToCopyFrom(userId, tripId),
    getAgentLabels(userId, trip.packingItems),
  ]);
  const initialView: PackingView = cookieStore.get("packingView")?.value === "suitcase" ? "suitcase" : "category";

  return (
    <div className="space-y-6">
      <SectionHeader
        tripId={trip.id}
        tripName={trip.name}
        title={t.packingList}
        tripsLabel={t.trips}
        icon={<ShoppingBag className="h-5 w-5" />}
        counts={counts}
      />
      <AgentLabelsProvider labels={agentLabels}>
        <PackingList
          tripId={trip.id}
          items={trip.packingItems}
          suitcases={trip.suitcases}
          unitSystem={user?.unitSystem ?? "METRIC"}
          tripsToCopy={tripsToCopy}
          initialView={initialView}
          hasDiveEquipment={ownedEquipmentCount > 0}
        />
      </AgentLabelsProvider>
    </div>
  );
}
