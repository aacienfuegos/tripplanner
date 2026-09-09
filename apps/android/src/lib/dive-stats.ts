// Port literal de apps/web/src/lib/dive-stats.ts — misma lógica, tipos
// adaptados a fechas ISO string (SQLite) en vez de Date/Prisma.
export type DiveStatsInput = {
  depthMax: number;
  bottomTime: number;
  waterTemp: number | null;
  date: string;
  diveSite: { id: number; name: string; country: string | null } | null;
};

export type DiveRecord = {
  diveSiteName: string | null;
  date: string;
  value: number;
};

export type DiveStats = {
  totalDives: number;
  totalBottomTimeMinutes: number;
  maxDepth: number | null;
  avgDepth: number | null;
  avgWaterTemp: number | null;
  sitesVisitedCount: number;
  countriesVisitedCount: number;
  firstDiveDate: string | null;
  lastDiveDate: string | null;
  deepestDive: DiveRecord | null;
  longestDive: DiveRecord | null;
};

const EMPTY_STATS: DiveStats = {
  totalDives: 0,
  totalBottomTimeMinutes: 0,
  maxDepth: null,
  avgDepth: null,
  avgWaterTemp: null,
  sitesVisitedCount: 0,
  countriesVisitedCount: 0,
  firstDiveDate: null,
  lastDiveDate: null,
  deepestDive: null,
  longestDive: null,
};

export function computeDiveStats(dives: readonly DiveStatsInput[]): DiveStats {
  if (dives.length === 0) return EMPTY_STATS;

  const totalBottomTimeMinutes = dives.reduce((sum, d) => sum + d.bottomTime, 0);
  const totalDepth = dives.reduce((sum, d) => sum + d.depthMax, 0);

  const withTemp = dives.filter((d): d is DiveStatsInput & { waterTemp: number } => d.waterTemp !== null);
  const avgWaterTemp = withTemp.length > 0 ? withTemp.reduce((sum, d) => sum + d.waterTemp, 0) / withTemp.length : null;

  const siteIds = new Set(dives.map((d) => d.diveSite?.id).filter((id): id is number => id != null));
  const countries = new Set(dives.map((d) => d.diveSite?.country).filter((c): c is string => !!c));

  const dates = dives.map((d) => d.date).sort();

  const deepest = dives.reduce((max, d) => (d.depthMax > max.depthMax ? d : max));
  const longest = dives.reduce((max, d) => (d.bottomTime > max.bottomTime ? d : max));

  return {
    totalDives: dives.length,
    totalBottomTimeMinutes,
    maxDepth: deepest.depthMax,
    avgDepth: totalDepth / dives.length,
    avgWaterTemp,
    sitesVisitedCount: siteIds.size,
    countriesVisitedCount: countries.size,
    firstDiveDate: dates[0] ?? null,
    lastDiveDate: dates[dates.length - 1] ?? null,
    deepestDive: { diveSiteName: deepest.diveSite?.name ?? null, date: deepest.date, value: deepest.depthMax },
    longestDive: { diveSiteName: longest.diveSite?.name ?? null, date: longest.date, value: longest.bottomTime },
  };
}
