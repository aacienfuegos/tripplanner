import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { MapPin, ArrowLeft, ExternalLink, Waves, ArrowDownToLine, Timer } from "lucide-react";
import { countryCodeToName } from "@tripplanner/shared";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DiveSiteDetailActions } from "@/components/dives/dive-site-detail-actions";
import { formatDiveDate } from "@/lib/dive-date";
import { getT } from "@/lib/locale";
import type { WebTKeys } from "@/i18n";

function waterTypeLabel(waterType: "SALT" | "FRESH" | "BRACKISH" | "CHLORINATED", t: WebTKeys): string {
  switch (waterType) {
    case "SALT":
      return t.waterTypeSalt;
    case "FRESH":
      return t.waterTypeFresh;
    case "BRACKISH":
      return t.waterTypeBrackish;
    case "CHLORINATED":
      return t.waterTypeChlorinated;
  }
}

export default async function DiveSiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUser();

  const [t, site, areas, dives] = await Promise.all([
    getT(),
    prisma.diveSite.findUnique({ where: { id, userId }, include: { diveArea: true } }),
    prisma.diveArea.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.diveLog.findMany({ where: { userId, diveSiteId: id }, orderBy: { date: "desc" } }),
  ]);
  if (!site) notFound();

  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const depths = dives.map((d) => d.depthMax);
  const mapsUrl =
    site.latitude != null && site.longitude != null
      ? `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/dives?tab=sites" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.diveSitesTab}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{site.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            {site.diveArea && (
              <Link href={`/dives/sites/areas/${site.diveArea.id}`} className="hover:underline">
                {site.diveArea.name}
              </Link>
            )}
            {[site.region, site.country].filter(Boolean).length > 0 && (
              <span>
                {[site.region, site.country && countryCodeToName(site.country, t.locale)]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
            {site.address && <span>· {site.address}</span>}
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              {t.viewOnMap} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {site.notes && <p className="text-sm italic text-muted-foreground max-w-prose">{site.notes}</p>}
        </div>
        <DiveSiteDetailActions site={site} areas={areas} />
      </div>

      {(site.maxDepth != null || site.waterType) && (
        <div className="flex flex-wrap gap-2">
          {site.maxDepth != null && <Badge variant="outline">{t.diveSiteMaxDepth(site.maxDepth)}</Badge>}
          {site.waterType && <Badge variant="outline">{waterTypeLabel(site.waterType, t)}</Badge>}
        </div>
      )}

      {dives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <Waves className="h-3 w-3" /> {t.diveSiteDiveCount(dives.length)}
          </Badge>
          <Badge variant="outline">{t.diveSiteFirstDive}: {formatDiveDate(dives[dives.length - 1].date, dfLocale)}</Badge>
          <Badge variant="outline">{t.diveSiteLastDive}: {formatDiveDate(dives[0].date, dfLocale)}</Badge>
          <Badge variant="outline">{t.diveSiteDepthRange(Math.min(...depths), Math.max(...depths))}</Badge>
        </div>
      )}

      {dives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDives}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {dives.map((dive) => (
            <Link key={dive.id} href={`/dives#${dive.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-3 flex items-center gap-4">
                  <Badge variant="secondary">#{dive.diveNumber}</Badge>
                  <span className="text-sm text-muted-foreground flex-1">{formatDiveDate(dive.date, dfLocale)}</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <ArrowDownToLine className="h-3.5 w-3.5" /> {dive.depthMax} m
                    <Timer className="h-3.5 w-3.5 ml-2" /> {dive.bottomTime} min
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
