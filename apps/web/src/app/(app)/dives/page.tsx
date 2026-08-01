import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { DiveLogList } from "@/components/dives/dive-log-list";
import { CertificationList } from "@/components/dives/certification-list";
import { DiveSiteList } from "@/components/dives/dive-site-list";
import { EquipmentList } from "@/components/dives/equipment-list";
import { DiveStatsView } from "@/components/dives/dive-stats";
import type { DiveSitePoint } from "@/components/dives/DiveSitesMapView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Waves, Award, MapPin, Anchor, BarChart3 } from "lucide-react";
import { getT } from "@/lib/locale";
import { computeDiveStats } from "@/lib/dive-stats";

const TAB_VALUES = ["log", "certifications", "sites", "equipment", "stats"] as const;

export default async function DivesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await requireUser();
  const { tab } = await searchParams;
  const defaultTab = TAB_VALUES.includes(tab as (typeof TAB_VALUES)[number]) ? tab! : "log";

  const [t, dives, sites, certifications, equipment, areas, sitesWithCount, allEquipment] = await Promise.all([
    getT(),
    prisma.diveLog.findMany({
      where: { userId },
      include: { diveSite: true, equipment: true },
      orderBy: { date: "desc" },
    }),
    prisma.diveSite.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.diveCertification.findMany({
      where: { userId },
      orderBy: { issueDate: "desc" },
    }),
    prisma.diveEquipment.findMany({
      where: { userId, status: "OWNED" },
      orderBy: { name: "asc" },
    }),
    prisma.diveArea.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.diveSite.findMany({
      where: { userId },
      include: { diveArea: true, _count: { select: { diveLogs: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.diveEquipment.findMany({
      where: { userId },
      include: { _count: { select: { diveLogs: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const diveStats = computeDiveStats(
    dives.map((d) => ({
      depthMax: d.depthMax,
      bottomTime: d.bottomTime,
      waterTemp: d.waterTemp,
      date: d.date,
      diveSite: d.diveSite ? { id: d.diveSite.id, name: d.diveSite.name, country: d.diveSite.country } : null,
    })),
  );

  const sitePoints: DiveSitePoint[] = sitesWithCount
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude!,
      lng: s.longitude!,
      subtitle: [s.diveArea?.name, s.region, s.country].filter(Boolean).join(", ") || null,
      diveCountLabel: t.diveSiteMapDiveCount(s._count.diveLogs),
      detailHref: `/dives/sites/${s.id}`,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t.dives}</h1>
      </div>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="log" className="gap-1.5">
            <Waves className="h-3.5 w-3.5" /> {t.diveLogsTab}
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> {t.diveCertificationsTab}
          </TabsTrigger>
          <TabsTrigger value="sites" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {t.diveSitesTab}
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-1.5">
            <Anchor className="h-3.5 w-3.5" /> {t.diveEquipmentTab}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> {t.diveStatsTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4">
          <DiveLogList dives={dives} sites={sites} equipment={equipment} />
        </TabsContent>
        <TabsContent value="certifications" className="mt-4">
          <CertificationList certifications={certifications} />
        </TabsContent>
        <TabsContent value="sites" className="mt-4">
          <DiveSiteList areas={areas} sites={sitesWithCount} sitePoints={sitePoints} />
        </TabsContent>
        <TabsContent value="equipment" className="mt-4">
          <EquipmentList equipment={allEquipment} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <DiveStatsView stats={diveStats} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
