import Link from "next/link";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { DiveSiteList } from "@/components/dives/dive-site-list";
import { buttonVariants } from "@/components/ui/button";
import { MapPin, ArrowLeft } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DiveSitesPage() {
  const userId = await requireUser();

  const [t, areas, sites] = await Promise.all([
    getT(),
    prisma.diveArea.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.diveSite.findMany({
      where: { userId },
      include: { diveArea: true, _count: { select: { diveLogs: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t.diveSitesTab}</h1>
        </div>
        <Link href="/dives" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.dives}
        </Link>
      </div>
      <DiveSiteList areas={areas} sites={sites} />
    </div>
  );
}
