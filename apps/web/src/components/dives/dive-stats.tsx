import { es as esLocale, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { formatDiveDate } from "@/lib/dive-date";
import type { DiveStats } from "@/lib/dive-stats";
import type { WebTKeys } from "@/i18n";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold leading-none">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DiveStatsView({ stats, t }: { stats: DiveStats; t: WebTKeys }) {
  const dfLocale = t.locale === "es" ? esLocale : enUS;

  if (stats.totalDives === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>{t.diveStatsEmpty}</p>
        </CardContent>
      </Card>
    );
  }

  const totalHours = Math.floor(stats.totalBottomTimeMinutes / 60);
  const totalMinutes = stats.totalBottomTimeMinutes % 60;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={t.diveStatsTotalDives} value={String(stats.totalDives)} />
        <StatCard label={t.diveStatsTotalTime} value={`${totalHours}h ${totalMinutes}m`} />
        <StatCard label={t.diveStatsMaxDepth} value={`${stats.maxDepth} m`} />
        <StatCard label={t.diveStatsAvgDepth} value={`${stats.avgDepth!.toFixed(1)} m`} />
        <StatCard label={t.diveStatsSitesVisited} value={String(stats.sitesVisitedCount)} />
        <StatCard label={t.diveStatsCountriesVisited} value={String(stats.countriesVisitedCount)} />
      </div>

      {(stats.avgWaterTemp !== null || stats.firstDiveDate) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.avgWaterTemp !== null && (
            <StatCard label={t.diveStatsAvgWaterTemp} value={`${stats.avgWaterTemp.toFixed(1)}°C`} />
          )}
          {stats.firstDiveDate && (
            <StatCard label={t.diveStatsDivingSince} value={formatDiveDate(stats.firstDiveDate, dfLocale)} />
          )}
          {stats.lastDiveDate && (
            <StatCard label={t.diveStatsLastDive} value={formatDiveDate(stats.lastDiveDate, dfLocale)} />
          )}
        </div>
      )}

      {(stats.deepestDive || stats.longestDive) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.deepestDive && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">{t.diveStatsDeepestDive}</p>
                <p className="text-lg font-semibold">{stats.deepestDive.value} m</p>
                <p className="text-xs text-muted-foreground">
                  {stats.deepestDive.diveSiteName ?? t.diveSiteNone} · {formatDiveDate(stats.deepestDive.date, dfLocale)}
                </p>
              </CardContent>
            </Card>
          )}
          {stats.longestDive && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">{t.diveStatsLongestDive}</p>
                <p className="text-lg font-semibold">{stats.longestDive.value} min</p>
                <p className="text-xs text-muted-foreground">
                  {stats.longestDive.diveSiteName ?? t.diveSiteNone} · {formatDiveDate(stats.longestDive.date, dfLocale)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
