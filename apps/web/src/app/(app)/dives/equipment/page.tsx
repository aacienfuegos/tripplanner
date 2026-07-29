import Link from "next/link";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { EquipmentList } from "@/components/dives/equipment-list";
import { buttonVariants } from "@/components/ui/button";
import { Anchor, ArrowLeft } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DiveEquipmentPage() {
  const userId = await requireUser();

  const [t, equipment] = await Promise.all([
    getT(),
    prisma.diveEquipment.findMany({
      where: { userId },
      include: { _count: { select: { diveLogs: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Anchor className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t.diveEquipmentTab}</h1>
        </div>
        <Link href="/dives" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.dives}
        </Link>
      </div>
      <EquipmentList equipment={equipment} />
    </div>
  );
}
