import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { DiveLogList } from "@/components/dives/dive-log-list";
import { CertificationList } from "@/components/dives/certification-list";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Waves, Award } from "lucide-react";
import { getT } from "@/lib/locale";

export default async function DivesPage() {
  const userId = await requireUser();

  const [t, dives, sites, certifications] = await Promise.all([
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
    prisma.diveCertification.findMany({
      where: { userId },
      orderBy: { issueDate: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t.dives}</h1>
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
          <DiveLogList dives={dives} sites={sites} />
        </TabsContent>
        <TabsContent value="certifications" className="mt-4">
          <CertificationList certifications={certifications} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
