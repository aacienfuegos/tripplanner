import { useState, useCallback, useMemo } from "react";
import { View, Text, SectionList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDiveSites, deleteDiveSite, DiveSite } from "@/db/dive-sites";
import { listDiveAreas, DiveArea } from "@/db/dive-areas";
import DiveSiteFormModal from "@/components/forms/DiveSiteFormModal";
import DiveSitesMapModal from "@/components/DiveSitesMapModal";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";
import { countryCodeToName } from "@tripplanner/shared";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

export default function DiveSitesScreen() {
  const router = useRouter();
  const { t, lang } = useT();
  const [sites, setSites] = useState<DiveSite[]>([]);
  const [areas, setAreas] = useState<DiveArea[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiveSite | undefined>();
  const [mapOpen, setMapOpen] = useState(false);

  const refresh = useCallback(() => {
    setSites(listDiveSites());
    setAreas(listDiveAreas());
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const sections = useMemo(() => {
    const byArea = new Map<number | null, DiveSite[]>();
    sites.forEach((s) => {
      const key = s.dive_area_id;
      if (!byArea.has(key)) byArea.set(key, []);
      byArea.get(key)!.push(s);
    });
    const areaName = (id: number | null) => (id === null ? t.diveAreaNone : areas.find((a) => a.id === id)?.name ?? t.diveAreaNone);
    return Array.from(byArea.entries())
      .map(([id, data]) => ({ title: areaName(id), data }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [sites, areas, t]);

  function openEdit(item: DiveSite) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.diveSitesTab,
        headerRight: () => (
          <TouchableOpacity onPress={() => setMapOpen(true)} className="mr-1 p-1" accessibilityLabel={t.viewDiveSitesMap}>
            <Ionicons name="map-outline" size={22} color={COLOR} />
          </TouchableOpacity>
        ),
      }} />

      <SectionList
        sections={sections}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="location-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noDiveSites}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noDiveSitesHint}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 mt-3">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/dives/site-detail?id=${item.id}`)}
            onLongPress={() => Alert.alert(item.name, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.delete, style: "destructive", onPress: () => { deleteDiveSite(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ])}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{item.name}</Text>
              {(item.region || item.country) && (
                <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {[item.region, item.country && countryCodeToName(item.country, lang)].filter(Boolean).join(", ")}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <DiveSiteFormModal
        visible={formOpen}
        initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDiveSite(editingItem.id); closeForm(); refresh(); } : undefined}
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
