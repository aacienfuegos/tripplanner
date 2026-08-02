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
import { DiveProfileChart } from "@/components/dives/DiveProfileChart";
import { DiveLogDetailActions } from "@/components/dives/dive-log-detail-actions";
import { resolveDiveProfile } from "@/lib/dive-profile";
import { formatDiveDate } from "@/lib/dive-date";
import { diveTypeLabel } from "@/lib/dive-type";
import { getT } from "@/lib/locale";

function Stat({ icon: Icon, label, value }: { icon: typeof ArrowDownToLine; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

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

      <Card>
        <CardContent className="pt-5">
          <DiveProfileChart samples={profile} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
        <Stat icon={ArrowDownToLine} label={t.diveDepthMax} value={`${dive.depthMax} m`} />
        {avgDepth != null && <Stat icon={Gauge} label={t.diveStatsAvgDepth} value={`${avgDepth.toFixed(1)} m`} />}
        <Stat icon={Timer} label={t.diveBottomTime} value={`${dive.bottomTime} min`} />
        {dive.waterTemp != null && <Stat icon={Thermometer} label={t.diveWaterTemp} value={`${dive.waterTemp}°C`} />}
        {dive.airTemp != null && <Stat icon={Thermometer} label={t.diveAirTemp} value={`${dive.airTemp}°C`} />}
        {dive.visibility != null && <Stat icon={Eye} label={t.diveVisibility} value={`${dive.visibility} m`} />}
        {dive.visibilityHorizontal != null && (
          <Stat icon={Eye} label={t.diveVisibilityHorizontal} value={`${dive.visibilityHorizontal} m`} />
        )}
        {dive.current && <Stat icon={Waves} label={t.diveCurrent} value={currentLabels[dive.current]} />}
        {(dive.pressureStart != null || dive.pressureEnd != null) && (
          <Stat
            icon={Wind}
            label={`${t.divePressureStart} → ${t.divePressureEnd}`}
            value={`${dive.pressureStart ?? "—"} → ${dive.pressureEnd ?? "—"} bar`}
          />
        )}
        {dive.gasMix !== "AIR" && dive.o2Percentage != null && (
          <Stat icon={Wind} label={t.diveO2Percentage} value={`${dive.o2Percentage}%`} />
        )}
        {dive.heliumPercentage != null && dive.heliumPercentage > 0 && (
          <Stat icon={Wind} label={t.diveHeliumPercentage} value={`${dive.heliumPercentage}%`} />
        )}
        {dive.weight != null && <Stat icon={Anchor} label={t.diveWeight} value={`${dive.weight} kg`} />}
        {dive.suitType && <Stat icon={Waves} label={t.diveSuitType} value={dive.suitType} />}
        {dive.buddyName && <Stat icon={Users} label={t.diveBuddyName} value={dive.buddyName} />}
        {dive.divemaster && <Stat icon={Users} label={t.diveDivemaster} value={dive.divemaster} />}
        {dive.boat && <Stat icon={Anchor} label={t.diveBoat} value={dive.boat} />}
        {dive.entryType && <Stat icon={Waves} label={t.diveEntryType} value={entryTypeLabels[dive.entryType]} />}
        {dive.safetyStopMinutes != null && (
          <Stat icon={Timer} label={t.diveSafetyStopMinutes} value={`${dive.safetyStopMinutes} min`} />
        )}
        {dive.minPpo2 != null && <Stat icon={Gauge} label={t.diveMinPpo2} value={`${dive.minPpo2} bar`} />}
        {dive.maxPpo2 != null && <Stat icon={Gauge} label={t.diveMaxPpo2} value={`${dive.maxPpo2} bar`} />}
        {dive.cnsPercent != null && <Stat icon={Gauge} label={t.diveCnsPercent} value={`${dive.cnsPercent}%`} />}
      </div>

      {dive.equipment.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t.diveEquipmentUsed}</h4>
          <div className="flex flex-wrap gap-2">
            {dive.equipment.map((eq) => (
              <Badge key={eq.id} variant="outline">{eq.name}</Badge>
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
    </div>
  );
}
