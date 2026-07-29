import Link from "next/link";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { DiveLogList } from "@/components/dives/dive-log-list";
import { CertificationList } from "@/components/dives/certification-list";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { Waves, Award, MapPin, Anchor } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DivesPage() {
  const userId = await requireUser();

  const [t, dives, sites, certifications, equipment] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t.dives}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dives/sites" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MapPin className="h-4 w-4 mr-1.5" /> {t.diveSitesTab}
          </Link>
          <Link href="/dives/equipment" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Anchor className="h-4 w-4 mr-1.5" /> {t.diveEquipmentTab}
          </Link>
        </div>
      </div>
      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log" className="gap-1.5">
            <Waves className="h-3.5 w-3.5" /> {t.diveLogsTab}
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> {t.diveCertificationsTab}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4">
          <DiveLogList dives={dives} sites={sites} equipment={equipment} />
        </TabsContent>
        <TabsContent value="certifications" className="mt-4">
          <CertificationList certifications={certifications} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
