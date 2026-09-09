import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowLeft, Waves } from "lucide-react";
import { countryCodeToName } from "@tripplanner/shared";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DiveAreaDetailActions } from "@/components/dives/dive-area-detail-actions";
import { getT } from "@/lib/locale";

export default async function DiveAreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUser();

  const [t, area, sites] = await Promise.all([
    getT(),
    prisma.diveArea.findUnique({ where: { id, userId } }),
    prisma.diveSite.findMany({
      where: { userId, diveAreaId: id },
      include: { _count: { select: { diveLogs: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!area) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dives?tab=sites" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.diveSitesTab}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{area.name}</h1>
            {area.country && <Badge variant="outline">{countryCodeToName(area.country, t.locale)}</Badge>}
          </div>
          {area.notes && <p className="text-sm italic text-muted-foreground max-w-prose">{area.notes}</p>}
        </div>
        <DiveAreaDetailActions area={area} />
      </div>

      {sites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDiveSites}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((site) => (
            <Link key={site.id} href={`/dives/sites/${site.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="pt-4 space-y-1">
                  <p className="font-medium truncate">{site.name}</p>
                  {(site.region || site.country) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[site.region, site.country && countryCodeToName(site.country, t.locale)]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  <Badge variant="outline" className="text-xs gap-1">
                    <Waves className="h-3 w-3" /> {t.diveSiteDiveCount(site._count.diveLogs)}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
