import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { DiveLogList } from "@/components/dives/dive-log-list";
import { Waves } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DivesPage() {
  const userId = await requireUser();

  const [t, dives, sites] = await Promise.all([
    getT(),
    prisma.diveLog.findMany({
      where: { userId },
      include: { diveSite: true },
      orderBy: { date: "desc" },
    }),
    prisma.diveSite.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t.dives}</h1>
      </div>
      <DiveLogList dives={dives} sites={sites} />
    </div>
  );
}
