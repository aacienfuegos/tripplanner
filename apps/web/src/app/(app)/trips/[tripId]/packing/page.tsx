import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackingList } from "@/components/packing/packing-list";
import { SectionHeader } from "@/components/layout/section-header";
import { ShoppingBag } from "lucide-react";

export default async function PackingPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { packingItems: { orderBy: [{ category: "asc" }, { name: "asc" }] } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Equipaje" icon={<ShoppingBag className="h-5 w-5" />} />
      <PackingList tripId={trip.id} items={trip.packingItems} />
    </div>
  );
}
