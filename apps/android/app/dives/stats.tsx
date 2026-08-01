import { useState, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { Tabs, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDiveStatsRows } from "@/db/dive-logs";
import { computeDiveStats, DiveStats } from "@/lib/dive-stats";
import { useT } from "@/contexts/I18nContext";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm flex-1 min-w-[45%]">
      <Text className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</Text>
      <Text className="text-2xl font-bold text-slate-900 dark:text-white">{value}</Text>
    </View>
  );
}

export default function DiveStatsScreen() {
  const { t, lang } = useT();
  const [stats, setStats] = useState<DiveStats | null>(null);

  useFocusEffect(useCallback(() => {
    setStats(computeDiveStats(listDiveStatsRows()));
  }, []));

  if (!stats) return null;

  if (stats.totalDives === 0) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
        <Tabs.Screen options={{ title: t.diveStatsTab }} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-sm text-slate-400 dark:text-slate-500 text-center">{t.diveStatsEmpty}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalHours = Math.floor(stats.totalBottomTimeMinutes / 60);
  const totalMinutes = stats.totalBottomTimeMinutes % 60;

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{ title: t.diveStatsTab }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>
        <View className="flex-row flex-wrap gap-3">
          <StatCard label={t.diveStatsTotalDives} value={String(stats.totalDives)} />
          <StatCard label={t.diveStatsTotalTime} value={`${totalHours}h ${totalMinutes}m`} />
          <StatCard label={t.diveStatsMaxDepth} value={`${stats.maxDepth} m`} />
          <StatCard label={t.diveStatsAvgDepth} value={`${stats.avgDepth!.toFixed(1)} m`} />
          <StatCard label={t.diveStatsSitesVisited} value={String(stats.sitesVisitedCount)} />
          <StatCard label={t.diveStatsCountriesVisited} value={String(stats.countriesVisitedCount)} />
        </View>

        {(stats.avgWaterTemp !== null || stats.firstDiveDate) && (
          <View className="flex-row flex-wrap gap-3">
            {stats.avgWaterTemp !== null && (
              <StatCard label={t.diveStatsAvgWaterTemp} value={`${stats.avgWaterTemp.toFixed(1)}°C`} />
            )}
            {stats.firstDiveDate && (
              <StatCard label={t.diveStatsDivingSince} value={formatDate(stats.firstDiveDate, lang)} />
            )}
            {stats.lastDiveDate && (
              <StatCard label={t.diveStatsLastDive} value={formatDate(stats.lastDiveDate, lang)} />
            )}
          </View>
        )}

        {(stats.deepestDive || stats.longestDive) && (
          <View className="gap-3">
            {stats.deepestDive && (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                <Text className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t.diveStatsDeepestDive}</Text>
                <Text className="text-lg font-semibold text-slate-900 dark:text-white">{stats.deepestDive.value} m</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {stats.deepestDive.diveSiteName ?? t.diveSiteNone} · {formatDate(stats.deepestDive.date, lang)}
                </Text>
              </View>
            )}
            {stats.longestDive && (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                <Text className="text-xs text-slate-400 dark:text-slate-500 mb-1">{t.diveStatsLongestDive}</Text>
                <Text className="text-lg font-semibold text-slate-900 dark:text-white">{stats.longestDive.value} min</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {stats.longestDive.diveSiteName ?? t.diveSiteNone} · {formatDate(stats.longestDive.date, lang)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
