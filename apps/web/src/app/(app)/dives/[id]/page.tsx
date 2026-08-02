import Link from "next/link";
import { notFound } from "next/navigation";
import { es as esLocale, enUS } from "date-fns/locale";
import {
  ArrowLeft, ArrowDownToLine, Timer, Thermometer, Eye, Star, MapPin,
  Waves, Gauge, Wind, Users, Anchor, ShieldAlert,
} from "lucide-react";
import { requireUser } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DiveChartsSection } from "@/components/dives/DiveChartsSection";
import { DiveLogDetailActions } from "@/components/dives/dive-log-detail-actions";
import { DiveTechnicalStats } from "@/components/dives/DiveTechnicalStats";
import { DASH, Stat, StatGroup } from "@/components/dives/DiveStat";
import { resolveDiveProfile } from "@/lib/dive-profile";
import { formatDiveDate } from "@/lib/dive-date";
import { diveTypeLabel } from "@/lib/dive-type";
import { getT } from "@/lib/locale";

export default async function DiveLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUser();

  const [t, dive, sites, equipment, samples] = await Promise.all([
    getT(),
    prisma.diveLog.findUnique({
      where: { id, userId },
      include: { diveSite: true, equipment: true },
    }),
    prisma.diveSite.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.diveEquipment.findMany({ where: { userId, status: "OWNED" }, orderBy: { name: "asc" } }),
    prisma.diveProfileSample.findMany({ where: { diveLogId: id }, orderBy: { seconds: "asc" } }),
  ]);
  if (!dive) notFound();

  const profile = resolveDiveProfile(dive, samples);
  const avgDepth = profile.length > 0 ? profile.reduce((sum, s) => sum + s.depth, 0) / profile.length : null;

  const gasMixLabels: Record<string, string> = {
    AIR: t.gasMixAir, NITROX: t.gasMixNitrox, TRIMIX: t.gasMixTrimix, OXYGEN: t.gasMixOxygen,
  };
  const currentLabels: Record<string, string> = {
    NONE: t.diveCurrentNone, LIGHT: t.diveCurrentLight, MODERATE: t.diveCurrentModerate, STRONG: t.diveCurrentStrong,
  };
  const entryTypeLabels: Record<string, string> = {
    SHORE: t.diveEntryTypeShore, BOAT: t.diveEntryTypeBoat,
  };

  return (
    <div className="space-y-6">
      <Link href="/dives" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> {t.diveLogsTab}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">#{dive.diveNumber}</Badge>
            <h1 className="text-2xl font-bold">{dive.diveSite?.name ?? t.diveSiteNone}</h1>
            {dive.decoRequired && (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> {t.diveDecoRequired}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>{formatDiveDate(dive.date, t.locale === "es" ? esLocale : enUS)}</span>
            {dive.diveType && <Badge variant="outline">{diveTypeLabel(dive.diveType, t)}</Badge>}
            <Badge variant="outline">{gasMixLabels[dive.gasMix]}</Badge>
            {dive.diveSite && (dive.diveSite.region || dive.diveSite.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[dive.diveSite.region, dive.diveSite.country].filter(Boolean).join(", ")}
              </span>
            )}
            {dive.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" /> {dive.rating}/5
              </span>
            )}
          </div>
        </div>
        <DiveLogDetailActions dive={dive} sites={sites} equipment={equipment} />
      </div>

      <StatGroup label={t.diveGroupProfile}>
        <Stat icon={ArrowDownToLine} label={t.diveDepthMax} value={`${dive.depthMax} m`} />
        <Stat icon={Gauge} label={t.diveStatsAvgDepth} value={avgDepth != null ? `${avgDepth.toFixed(1)} m` : DASH} />
        <Stat icon={Timer} label={t.diveBottomTime} value={`${dive.bottomTime} min`} />
        <Stat icon={Timer} label={t.diveSurfaceInterval} value={dive.surfaceInterval != null ? `${dive.surfaceInterval} min` : DASH} />
      </StatGroup>

      <StatGroup label={t.diveGroupGas}>
        <Stat icon={Wind} label={t.diveGasMix} value={gasMixLabels[dive.gasMix]} />
        <Stat icon={Wind} label={t.diveO2Percentage} value={dive.o2Percentage != null ? `${dive.o2Percentage}%` : DASH} />
        <Stat icon={Wind} label={t.diveHeliumPercentage} value={dive.heliumPercentage != null ? `${dive.heliumPercentage}%` : DASH} />
        <Stat icon={Wind} label={t.divePressureStart} value={dive.pressureStart != null ? `${dive.pressureStart} bar` : DASH} />
        <Stat icon={Wind} label={t.divePressureEnd} value={dive.pressureEnd != null ? `${dive.pressureEnd} bar` : DASH} />
      </StatGroup>

      <StatGroup label={t.diveGroupConditions}>
        <Stat icon={Thermometer} label={t.diveWaterTemp} value={dive.waterTemp != null ? `${dive.waterTemp}°C` : DASH} />
        <Stat icon={Thermometer} label={t.diveAirTemp} value={dive.airTemp != null ? `${dive.airTemp}°C` : DASH} />
        <Stat icon={Eye} label={t.diveVisibility} value={dive.visibility != null ? `${dive.visibility} m` : DASH} />
        <Stat icon={Eye} label={t.diveVisibilityHorizontal} value={dive.visibilityHorizontal != null ? `${dive.visibilityHorizontal} m` : DASH} />
        <Stat icon={Waves} label={t.diveCurrent} value={dive.current ? currentLabels[dive.current] : DASH} />
        <Stat icon={Waves} label={t.diveEntryType} value={dive.entryType ? entryTypeLabels[dive.entryType] : DASH} />
        <Stat icon={Waves} label={t.diveSuitType} value={dive.suitType ?? DASH} />
        <Stat icon={Anchor} label={t.diveWeight} value={dive.weight != null ? `${dive.weight} kg` : DASH} />
      </StatGroup>

      <DiveTechnicalStats
        groupLabel={t.diveGroupTechnical}
        showLabel={t.diveShowTechnicalData}
        hideLabel={t.diveHideTechnicalData}
        hasData={
          dive.safetyStopMinutes != null || dive.minPpo2 != null || dive.maxPpo2 != null || dive.cnsPercent != null || dive.decoRequired
        }
      >
        <Stat icon={Timer} label={t.diveSafetyStopMinutes} value={dive.safetyStopMinutes != null ? `${dive.safetyStopMinutes} min` : DASH} />
        <Stat icon={Gauge} label={t.diveMinPpo2} value={dive.minPpo2 != null ? `${dive.minPpo2} bar` : DASH} />
        <Stat icon={Gauge} label={t.diveMaxPpo2} value={dive.maxPpo2 != null ? `${dive.maxPpo2} bar` : DASH} />
        <Stat icon={Gauge} label={t.diveCnsPercent} value={dive.cnsPercent != null ? `${dive.cnsPercent}%` : DASH} />
      </DiveTechnicalStats>

      <StatGroup label={t.diveGroupNotes}>
        <Stat icon={Users} label={t.diveBuddyName} value={dive.buddyName ?? DASH} />
        <Stat icon={Users} label={t.diveDivemaster} value={dive.divemaster ?? DASH} />
        <Stat icon={Anchor} label={t.diveBoat} value={dive.boat ?? DASH} />
      </StatGroup>

      {dive.equipment.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t.diveEquipmentUsed}</h4>
          <div className="flex flex-wrap gap-2">
            {dive.equipment.map((eq) => (
              <Link key={eq.id} href={`/dives/equipment/${eq.id}`}>
                <Badge variant="outline" className="hover:bg-accent cursor-pointer transition-colors">
                  {eq.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {dive.notes && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium text-muted-foreground">{t.notes}</h4>
          <p className="text-sm italic">{dive.notes}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <DiveChartsSection samples={profile} site={dive.diveSite} />
        </CardContent>
      </Card>
    </div>
  );
}
