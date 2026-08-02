import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Tabs, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import {
  getDiveLog, deleteDiveLog, listDiveLogEquipmentIds, getProfileSamples, DiveLog,
} from "@/db/dive-logs";
import { getDiveSite, DiveSite } from "@/db/dive-sites";
import { listDiveEquipment } from "@/db/dive-equipment";
import { resolveDiveProfile } from "@/lib/dive-profile";
import DiveProfileChart from "@/components/DiveProfileChart";
import DiveLogFormModal from "@/components/forms/DiveLogFormModal";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="w-1/2 pr-2 mb-4">
      <View className="flex-row items-center gap-1.5 mb-0.5">
        <Ionicons name={icon} size={13} color="#94a3b8" />
        <Text className="text-xs text-slate-400 dark:text-slate-500">{label}</Text>
      </View>
      <Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</Text>
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
  const [equipmentNames, setEquipmentNames] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const refresh = useCallback(() => {
    const d = getDiveLog(diveId);
    setDive(d);
    setSite(d?.dive_site_id ? getDiveSite(d.dive_site_id) : null);
    const equipmentIds = new Set(listDiveLogEquipmentIds(diveId));
    setEquipmentNames(listDiveEquipment().filter((e) => equipmentIds.has(e.id)).map((e) => e.name));
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

  if (!dive) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
        <Tabs.Screen options={{ title: "" }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: `#${dive.dive_number} ${site?.name ?? t.diveSiteNone}`,
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

        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm mb-4">
          <DiveProfileChart samples={profile} />
        </View>

        <View className="flex-row flex-wrap">
          <Stat icon="arrow-down" label={t.diveDepthMax} value={`${dive.depth_max} m`} />
          {avgDepth != null && <Stat icon="analytics-outline" label={t.diveStatsAvgDepth} value={`${avgDepth.toFixed(1)} m`} />}
          <Stat icon="time-outline" label={t.diveBottomTime} value={`${dive.bottom_time} min`} />
          {dive.water_temp != null && <Stat icon="thermometer-outline" label={t.diveWaterTemp} value={`${dive.water_temp}°C`} />}
          {dive.air_temp != null && <Stat icon="thermometer-outline" label={t.diveAirTemp} value={`${dive.air_temp}°C`} />}
          {dive.visibility != null && <Stat icon="eye-outline" label={t.diveVisibility} value={`${dive.visibility} m`} />}
          {dive.visibility_horizontal != null && (
            <Stat icon="eye-outline" label={t.diveVisibilityHorizontal} value={`${dive.visibility_horizontal} m`} />
          )}
          {dive.current && <Stat icon="water-outline" label={t.diveCurrent} value={currentLabels[dive.current]} />}
          {(dive.pressure_start != null || dive.pressure_end != null) && (
            <Stat icon="speedometer-outline" label={`${t.divePressureStart} → ${t.divePressureEnd}`} value={`${dive.pressure_start ?? "—"} → ${dive.pressure_end ?? "—"} bar`} />
          )}
          {dive.gas_mix !== "AIR" && dive.o2_percentage != null && (
            <Stat icon="flask-outline" label={t.diveO2Percentage} value={`${dive.o2_percentage}%`} />
          )}
          {dive.helium_percentage != null && dive.helium_percentage > 0 && (
            <Stat icon="flask-outline" label={t.diveHeliumPercentage} value={`${dive.helium_percentage}%`} />
          )}
          {dive.weight != null && <Stat icon="barbell-outline" label={t.diveWeight} value={`${dive.weight} kg`} />}
          {dive.suit_type && <Stat icon="shirt-outline" label={t.diveSuitType} value={dive.suit_type} />}
          {dive.buddy_name && <Stat icon="people-outline" label={t.diveBuddyName} value={dive.buddy_name} />}
          {dive.divemaster && <Stat icon="people-outline" label={t.diveDivemaster} value={dive.divemaster} />}
          {dive.boat && <Stat icon="boat-outline" label={t.diveBoat} value={dive.boat} />}
          {dive.entry_type && <Stat icon="footsteps-outline" label={t.diveEntryType} value={entryTypeLabels[dive.entry_type]} />}
          {dive.safety_stop_minutes != null && (
            <Stat icon="time-outline" label={t.diveSafetyStopMinutes} value={`${dive.safety_stop_minutes} min`} />
          )}
          {dive.min_ppo2 != null && <Stat icon="speedometer-outline" label={t.diveMinPpo2} value={`${dive.min_ppo2} bar`} />}
          {dive.max_ppo2 != null && <Stat icon="speedometer-outline" label={t.diveMaxPpo2} value={`${dive.max_ppo2} bar`} />}
          {dive.cns_percent != null && <Stat icon="pulse-outline" label={t.diveCnsPercent} value={`${dive.cns_percent}%`} />}
        </View>

        {equipmentNames.length > 0 && (
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{t.diveEquipmentUsed}</Text>
            <View className="flex-row flex-wrap gap-2">
              {equipmentNames.map((name) => (
                <View key={name} className="rounded-full px-2.5 py-1 border border-gray-200 dark:border-zinc-700">
                  <Text className="text-xs text-slate-600 dark:text-slate-300">{name}</Text>
                </View>
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
