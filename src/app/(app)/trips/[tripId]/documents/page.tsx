import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentsList } from "@/components/documents/documents-list";
import { SectionHeader } from "@/components/layout/section-header";
import { FileText } from "lucide-react";

export default async function DocumentsPage({ params }: { params: { tripId: string } }) {
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: params.tripId },
    include: { documents: { orderBy: { createdAt: "asc" } } },
  });
  if (!trip || trip.userId !== session!.user!.id) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Documentos" icon={<FileText className="h-5 w-5" />} />
      <DocumentsList tripId={trip.id} documents={trip.documents} />
    </div>
  );
}
