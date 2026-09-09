import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDiveLogs, deleteDiveLog, DiveLog } from "@/db/dive-logs";
import { listDiveSites, DiveSite } from "@/db/dive-sites";
import DiveLogFormModal from "@/components/forms/DiveLogFormModal";
import DiveSitesMapModal from "@/components/DiveSitesMapModal";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function DiveLogsScreen() {
  const router = useRouter();
  const { t, lang } = useT();
  const [dives, setDives] = useState<DiveLog[]>([]);
  const [sites, setSites] = useState<DiveSite[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiveLog | undefined>();
  const [mapOpen, setMapOpen] = useState(false);

  const refresh = useCallback(() => {
    setDives(listDiveLogs());
    setSites(listDiveSites());
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const siteNames = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sites]);

  function openEdit(item: DiveLog) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.diveLogsTab,
        headerRight: () => (
          <TouchableOpacity onPress={() => setMapOpen(true)} className="mr-1 p-1" accessibilityLabel={t.viewDiveSitesMap}>
            <Ionicons name="map-outline" size={22} color={COLOR} />
          </TouchableOpacity>
        ),
      }} />

      <FlatList
        data={dives}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="water-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noDives}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noDivesHint}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/dives/dive-detail?id=${item.id}`)}
            onLongPress={() => Alert.alert(`#${item.dive_number}`, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.delete, style: "destructive", onPress: () => { deleteDiveLog(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ])}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-start justify-between mb-1">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                    <Text className="text-xs font-bold" style={{ color: COLOR }}>#{item.dive_number}</Text>
                  </View>
                  <Text className="text-base font-bold text-slate-900 dark:text-white flex-1" numberOfLines={1}>
                    {item.dive_site_id ? siteNames.get(item.dive_site_id) ?? t.diveSiteNone : t.diveSiteNone}
                  </Text>
                </View>
                {item.rating ? (
                  <View className="flex-row items-center gap-0.5">
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.rating}</Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center gap-3 mt-1 flex-wrap">
                <Text className="text-xs text-slate-400 dark:text-slate-500">{formatDate(item.date, lang)}</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500">{item.depth_max} m</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500">{item.bottom_time} min</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <DiveLogFormModal
        visible={formOpen}
        tripId={null}
        initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDiveLog(editingItem.id); closeForm(); refresh(); } : undefined}
      />

      <DiveSitesMapModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        sites={sites}
        onViewSite={(siteId) => router.push(`/dives/site-detail?id=${siteId}`)}
      />
    </SafeAreaView>
  );
}
