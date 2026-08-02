import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  listDiveLogs, listDiveLogsForTrip, linkDiveToTrip, unlinkDiveFromTrip, deleteDiveLog, DiveLog,
} from "@/db/dive-logs";
import { listDiveSites, DiveSite } from "@/db/dive-sites";
import DiveLogFormModal from "@/components/forms/DiveLogFormModal";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";
import { useTripLock } from "@/contexts/TripLockContext";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function TripDivesScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();
  const { isLocked, guard } = useTripLock();
  const [dives, setDives] = useState<DiveLog[]>([]);
  const [allDives, setAllDives] = useState<DiveLog[]>([]);
  const [sites, setSites] = useState<DiveSite[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiveLog | undefined>();

  const refresh = useCallback(() => {
    setDives(listDiveLogsForTrip(tripId));
    setAllDives(listDiveLogs());
    setSites(listDiveSites());
  }, [tripId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const siteNames = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sites]);

  const availableDives = useMemo(() => allDives.filter((d) => d.trip_id === null), [allDives]);

  function openEdit(item: DiveLog) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  function siteLabel(d: DiveLog) {
    return d.dive_site_id ? siteNames.get(d.dive_site_id) ?? t.diveSiteNone : t.diveSiteNone;
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.dives,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push(`/trips/${id}/map`)} className="mr-3">
            <Ionicons name="map-outline" size={20} color={COLOR} />
          </TouchableOpacity>
        ),
      }} />

      {availableDives.length > 0 && (
        <View className="px-4 pt-3">
          <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
            {t.linkDiveSelectPlaceholder}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 pb-1">
              {availableDives.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => guard(() => { linkDiveToTrip(d.id, tripId); refresh(); })}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed"
                  style={{ borderColor: COLOR }}
                >
                  <Ionicons name="link-outline" size={13} color={COLOR} />
                  <Text className="text-sm font-medium" style={{ color: COLOR }}>
                    #{d.dive_number} · {siteLabel(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <FlatList
        data={dives}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="water-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noTripDives}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => guard(() => openEdit(item))}
            onLongPress={() => guard(() => Alert.alert(`#${item.dive_number}`, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.unlinkDive, onPress: () => { unlinkDiveFromTrip(item.id); refresh(); } },
              { text: t.delete, style: "destructive", onPress: () => { deleteDiveLog(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ]))}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                    <Text className="text-xs font-bold" style={{ color: COLOR }}>#{item.dive_number}</Text>
                  </View>
                  <Text className="text-base font-bold text-slate-900 dark:text-white flex-1" numberOfLines={1}>
                    {siteLabel(item)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => guard(() => { unlinkDiveFromTrip(item.id); refresh(); })} hitSlop={8}>
                  <Ionicons name="link-outline" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center gap-3 mt-1.5 flex-wrap">
                <Text className="text-xs text-slate-400 dark:text-slate-500">{formatDate(item.date, lang)}</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500">{item.depth_max} m</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500">{item.bottom_time} min</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={() => guard(openAdd)} color={COLOR} locked={isLocked} />

      <DiveLogFormModal
        visible={formOpen}
        tripId={tripId}
        initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDiveLog(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
