import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { Tabs, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import {
  getDiveLog, deleteDiveLog, listDiveLogEquipmentIds, getProfileSamples, DiveLog,
} from "@/db/dive-logs";
import { getDiveSite, DiveSite } from "@/db/dive-sites";
import { listDiveEquipment, DiveEquipment } from "@/db/dive-equipment";
import { resolveDiveProfile } from "@/lib/dive-profile";
import DiveProfileChart, { DiveTempChart, DiveNdlChart } from "@/components/DiveProfileChart";
import { buildMapHtml } from "@/components/DiveSitesMapModal";
import DiveLogFormModal from "@/components/forms/DiveLogFormModal";
import { useT } from "@/contexts/I18nContext";

const CHART_TABS = ["profile", "temp", "ndl", "map"] as const;
type ChartTab = (typeof CHART_TABS)[number];

const COLOR = "#0e7490";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

const DASH = "-";

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="w-1/2 pr-2 mb-4">
      <View className="flex-row items-center gap-1.5 mb-0.5">
        <Ionicons name={icon} size={13} color="#94a3b8" />
        <Text className="text-xs text-slate-400 dark:text-slate-500">{label}</Text>
      </View>
      <Text className={`text-sm font-medium ${value === DASH ? "text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-slate-200"}`}>
        {value}
      </Text>
    </View>
  );
}

const groupLabel = "text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2";

function StatGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-2">
      <Text className={groupLabel}>{label}</Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}

interface TechnicalStat {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function TechnicalStatsGroup({
  groupLabel: title,
  showLabel,
  hideLabel,
  hasData,
  stats,
  isDark,
}: {
  groupLabel: string;
  showLabel: string;
  hideLabel: string;
  hasData: boolean;
  stats: TechnicalStat[];
  isDark: boolean;
}) {
  const [open, setOpen] = useState(hasData);
  return (
    <View className="mb-2">
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-1 mb-2"
        accessibilityLabel={open ? hideLabel : showLabel}
      >
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={isDark ? "#71717a" : "#94a3b8"} />
        <Text className={groupLabel}>{title}</Text>
      </TouchableOpacity>
      {open && <View className="flex-row flex-wrap">{stats.map((s) => <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} />)}</View>}
    </View>
  );
}

export default function DiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diveId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [dive, setDive] = useState<DiveLog | null>(null);
  const [site, setSite] = useState<DiveSite | null>(null);
  const [diveEquipment, setDiveEquipment] = useState<DiveEquipment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [chartTab, setChartTab] = useState<ChartTab>("profile");

  const refresh = useCallback(() => {
    const d = getDiveLog(diveId);
    setDive(d);
    setSite(d?.dive_site_id ? getDiveSite(d.dive_site_id) : null);
    const equipmentIds = new Set(listDiveLogEquipmentIds(diveId));
    setDiveEquipment(listDiveEquipment().filter((e) => equipmentIds.has(e.id)));
  }, [diveId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const profile = useMemo(() => {
    if (!dive) return [];
    return resolveDiveProfile(dive, getProfileSamples(dive.id));
  }, [dive]);

  const avgDepth = useMemo(() => {
    if (profile.length === 0) return null;
    return profile.reduce((sum, s) => sum + s.depth, 0) / profile.length;
  }, [profile]);

  const gasMixLabels: Record<DiveLog["gas_mix"], string> = {
    AIR: t.gasMixAir, NITROX: t.gasMixNitrox, TRIMIX: t.gasMixTrimix, OXYGEN: t.gasMixOxygen,
  };
  const diveTypeLabels: Record<string, string> = {
    RECREATIONAL: t.diveTypeRecreational, TRAINING: t.diveTypeTraining, NIGHT: t.diveTypeNight,
    WRECK: t.diveTypeWreck, DRIFT: t.diveTypeDrift, DEEP: t.diveTypeDeep, CAVE: t.diveTypeCave,
    FREEDIVE: t.diveTypeFreedive,
  };
  const currentLabels: Record<string, string> = {
    NONE: t.diveCurrentNone, LIGHT: t.diveCurrentLight, MODERATE: t.diveCurrentModerate, STRONG: t.diveCurrentStrong,
  };
  const entryTypeLabels: Record<string, string> = {
    SHORE: t.diveEntryTypeShore, BOAT: t.diveEntryTypeBoat,
  };
  const chartTabLabels: Record<ChartTab, string> = {
    profile: t.diveProfileTabDepth, temp: t.diveProfileTabTemp,
    ndl: t.diveProfileTabNdl, map: t.diveProfileTabMap,
  };
  const chartTabIcons: Record<ChartTab, keyof typeof Ionicons.glyphMap> = {
    profile: "water-outline", temp: "thermometer-outline", ndl: "time-outline", map: "map-outline",
  };

  if (!dive) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
        <Tabs.Screen options={{
          title: "",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-3">
              <Ionicons name="arrow-back" size={24} color={isDark ? "#f1f5f9" : "#374151"} />
            </TouchableOpacity>
          ),
        }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: `#${dive.dive_number} ${site?.name ?? t.diveSiteNone}`,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} className="ml-3">
            <Ionicons name="arrow-back" size={24} color={isDark ? "#f1f5f9" : "#374151"} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => setEditOpen(true)}>
            <Ionicons name="pencil" size={20} color={isDark ? "#f1f5f9" : "#374151"} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="flex-row items-center gap-2 mb-1 flex-wrap">
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: "#0e749018" }}>
            <Text className="text-xs font-bold" style={{ color: COLOR }}>#{dive.dive_number}</Text>
          </View>
          {dive.deco_required === 1 && (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-900/30">
              <Ionicons name="warning" size={11} color="#dc2626" />
              <Text className="text-xs font-semibold text-red-600 dark:text-red-400">{t.diveDecoRequired}</Text>
            </View>
          )}
        </View>
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-1">{site?.name ?? t.diveSiteNone}</Text>
        <View className="flex-row items-center gap-2 flex-wrap mb-4">
          <Text className="text-xs text-slate-400 dark:text-slate-500">{formatDate(dive.date, lang)}</Text>
          {dive.dive_type && (
            <View className="rounded-full px-2 py-0.5 border border-gray-200 dark:border-zinc-700">
              <Text className="text-xs text-slate-600 dark:text-slate-300">{diveTypeLabels[dive.dive_type] ?? dive.dive_type}</Text>
            </View>
          )}
          <View className="rounded-full px-2 py-0.5 border border-gray-200 dark:border-zinc-700">
            <Text className="text-xs text-slate-600 dark:text-slate-300">{gasMixLabels[dive.gas_mix]}</Text>
          </View>
          {dive.rating != null && (
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{dive.rating}</Text>
            </View>
          )}
        </View>

        <StatGroup label={t.diveGroupProfile}>
          <Stat icon="arrow-down" label={t.diveDepthMax} value={`${dive.depth_max} m`} />
          <Stat icon="analytics-outline" label={t.diveStatsAvgDepth} value={avgDepth != null ? `${avgDepth.toFixed(1)} m` : DASH} />
          <Stat icon="time-outline" label={t.diveBottomTime} value={`${dive.bottom_time} min`} />
          <Stat icon="time-outline" label={t.diveSurfaceInterval} value={dive.surface_interval != null ? `${dive.surface_interval} min` : DASH} />
        </StatGroup>

        <StatGroup label={t.diveGroupGas}>
          <Stat icon="flask-outline" label={t.diveGasMix} value={gasMixLabels[dive.gas_mix]} />
          <Stat icon="flask-outline" label={t.diveO2Percentage} value={dive.o2_percentage != null ? `${dive.o2_percentage}%` : DASH} />
          <Stat icon="flask-outline" label={t.diveHeliumPercentage} value={dive.helium_percentage != null ? `${dive.helium_percentage}%` : DASH} />
          <Stat icon="speedometer-outline" label={t.divePressureStart} value={dive.pressure_start != null ? `${dive.pressure_start} bar` : DASH} />
          <Stat icon="speedometer-outline" label={t.divePressureEnd} value={dive.pressure_end != null ? `${dive.pressure_end} bar` : DASH} />
        </StatGroup>

        <StatGroup label={t.diveGroupConditions}>
          <Stat icon="thermometer-outline" label={t.diveWaterTemp} value={dive.water_temp != null ? `${dive.water_temp}°C` : DASH} />
          <Stat icon="thermometer-outline" label={t.diveAirTemp} value={dive.air_temp != null ? `${dive.air_temp}°C` : DASH} />
          <Stat icon="eye-outline" label={t.diveVisibility} value={dive.visibility != null ? `${dive.visibility} m` : DASH} />
          <Stat icon="eye-outline" label={t.diveVisibilityHorizontal} value={dive.visibility_horizontal != null ? `${dive.visibility_horizontal} m` : DASH} />
          <Stat icon="water-outline" label={t.diveCurrent} value={dive.current ? currentLabels[dive.current] : DASH} />
          <Stat icon="footsteps-outline" label={t.diveEntryType} value={dive.entry_type ? entryTypeLabels[dive.entry_type] : DASH} />
          <Stat icon="shirt-outline" label={t.diveSuitType} value={dive.suit_type ?? DASH} />
          <Stat icon="barbell-outline" label={t.diveWeight} value={dive.weight != null ? `${dive.weight} kg` : DASH} />
        </StatGroup>

        <TechnicalStatsGroup
          groupLabel={t.diveGroupTechnical}
          showLabel={t.diveShowTechnicalData}
          hideLabel={t.diveHideTechnicalData}
          isDark={isDark}
          hasData={
            dive.safety_stop_minutes != null || dive.min_ppo2 != null || dive.max_ppo2 != null || dive.cns_percent != null || dive.deco_required === 1
          }
          stats={[
            { icon: "time-outline", label: t.diveSafetyStopMinutes, value: dive.safety_stop_minutes != null ? `${dive.safety_stop_minutes} min` : DASH },
            { icon: "speedometer-outline", label: t.diveMinPpo2, value: dive.min_ppo2 != null ? `${dive.min_ppo2} bar` : DASH },
            { icon: "speedometer-outline", label: t.diveMaxPpo2, value: dive.max_ppo2 != null ? `${dive.max_ppo2} bar` : DASH },
            { icon: "pulse-outline", label: t.diveCnsPercent, value: dive.cns_percent != null ? `${dive.cns_percent}%` : DASH },
          ]}
        />

        <StatGroup label={t.diveGroupNotes}>
          <Stat icon="people-outline" label={t.diveBuddyName} value={dive.buddy_name ?? DASH} />
          <Stat icon="people-outline" label={t.diveDivemaster} value={dive.divemaster ?? DASH} />
          <Stat icon="boat-outline" label={t.diveBoat} value={dive.boat ?? DASH} />
        </StatGroup>

        {diveEquipment.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{t.diveEquipmentUsed}</Text>
            <View className="flex-row flex-wrap gap-2">
              {diveEquipment.map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  onPress={() => router.push(`/dives/equipment-detail?id=${eq.id}`)}
                  className="rounded-full px-2.5 py-1 border border-gray-200 dark:border-zinc-700"
                >
                  <Text className="text-xs text-slate-600 dark:text-slate-300">{eq.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {dive.notes && (
          <View>
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{t.notes}</Text>
            <Text className="text-sm italic text-slate-600 dark:text-slate-300">{dive.notes}</Text>
          </View>
        )}

        <View className="flex-row gap-2 mb-3">
          {CHART_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setChartTab(tab)}
              className={`flex-1 flex-row items-center justify-center gap-1 py-2 rounded-full ${chartTab === tab ? "bg-cyan-700" : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"}`}
            >
              <Ionicons name={chartTabIcons[tab]} size={13} color={chartTab === tab ? "#fff" : isDark ? "#94a3b8" : "#64748b"} />
              <Text className={`text-xs font-semibold ${chartTab === tab ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>
                {chartTabLabels[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm">
          {chartTab === "profile" && <DiveProfileChart samples={profile} />}
          {chartTab === "temp" && <DiveTempChart samples={profile} />}
          {chartTab === "ndl" && <DiveNdlChart samples={profile} />}
          {chartTab === "map" && (
            site?.latitude != null && site?.longitude != null ? (
              <View style={{ height: 240 }} className="rounded-xl overflow-hidden">
                <WebView
                  originWhitelist={["*"]}
                  source={{ html: buildMapHtml(
                    [{ id: site.id, name: site.name, subtitle: null, diveCountLabel: "", lat: site.latitude, lng: site.longitude }],
                    t.viewDetail,
                  ) }}
                  javaScriptEnabled
                  domStorageEnabled
                />
              </View>
            ) : (
              <Text className="text-sm text-center text-slate-500 dark:text-slate-400 py-10">{t.diveProfileNoMapData}</Text>
            )
          )}
        </View>
      </ScrollView>

      <DiveLogFormModal
        visible={editOpen}
        tripId={dive.trip_id}
        initialData={dive}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); refresh(); }}
        onDelete={() => {
          deleteDiveLog(dive.id);
          setEditOpen(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
