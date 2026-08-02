import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Tabs, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { getDiveSite, deleteDiveSite, DiveSite } from "@/db/dive-sites";
import { getDiveArea, DiveArea } from "@/db/dive-areas";
import { listDiveLogsForSite, DiveLog } from "@/db/dive-logs";
import DiveSiteFormModal from "@/components/forms/DiveSiteFormModal";
import DiveLogFormModal from "@/components/forms/DiveLogFormModal";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function DiveSiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const siteId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [site, setSite] = useState<DiveSite | null>(null);
  const [area, setArea] = useState<DiveArea | null>(null);
  const [dives, setDives] = useState<DiveLog[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDive, setEditingDive] = useState<DiveLog | undefined>();
  const [diveFormOpen, setDiveFormOpen] = useState(false);

  const refresh = useCallback(() => {
    const s = getDiveSite(siteId);
    setSite(s);
    setArea(s?.dive_area_id ? getDiveArea(s.dive_area_id) : null);
    setDives(listDiveLogsForSite(siteId));
  }, [siteId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (!site) {
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

  const depths = dives.map((d) => d.depth_max);
  const mapsUrl = site.latitude != null && site.longitude != null
    ? `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
    : null;

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: site.name,
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
        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4">
          {(area || site.region || site.country) && (
            <Text className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {[area?.name, site.region, site.country].filter(Boolean).join(" · ")}
            </Text>
          )}
          {site.address && (
            <Text className="text-sm text-slate-500 dark:text-slate-400 mb-1">{site.address}</Text>
          )}
          {mapsUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)} className="flex-row items-center gap-1.5 mt-1">
              <Text className="text-sm font-medium" style={{ color: COLOR }}>{t.viewOnMap}</Text>
              <Ionicons name="open-outline" size={13} color={COLOR} />
            </TouchableOpacity>
          )}
          {site.notes && (
            <Text className="text-sm text-slate-600 dark:text-slate-300 mt-3 italic">{site.notes}</Text>
          )}

          {dives.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-zinc-800">
              <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950">
                <Ionicons name="water-outline" size={12} color={COLOR} />
                <Text className="text-xs font-medium" style={{ color: COLOR }}>{t.diveSiteDiveCount(dives.length)}</Text>
              </View>
              <View className="rounded-full px-2.5 py-1 bg-slate-100 dark:bg-zinc-800">
                <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t.diveSiteFirstDive}: {formatDate(dives[dives.length - 1].date, lang)}
                </Text>
              </View>
              <View className="rounded-full px-2.5 py-1 bg-slate-100 dark:bg-zinc-800">
                <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t.diveSiteLastDive}: {formatDate(dives[0].date, lang)}
                </Text>
              </View>
              <View className="rounded-full px-2.5 py-1 bg-slate-100 dark:bg-zinc-800">
                <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t.diveSiteDepthRange(Math.min(...depths), Math.max(...depths))}
                </Text>
              </View>
            </View>
          )}
        </View>

        {dives.length === 0 ? (
          <Text className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">{t.noDives}</Text>
        ) : (
          dives.map((d) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => { setEditingDive(d); setDiveFormOpen(true); }}
              className="bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 mb-2 shadow-sm flex-row items-center gap-3"
            >
              <View className="rounded-full px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950">
                <Text className="text-xs font-bold" style={{ color: COLOR }}>#{d.dive_number}</Text>
              </View>
              <Text className="text-sm text-slate-500 dark:text-slate-400 flex-1">{formatDate(d.date, lang)}</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400">{d.depth_max} m</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400">{d.bottom_time} min</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <DiveSiteFormModal
        visible={editOpen}
        initialData={site}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); refresh(); }}
        onDelete={() => { deleteDiveSite(site.id); setEditOpen(false); router.back(); }}
      />
      <DiveLogFormModal
        visible={diveFormOpen}
        tripId={null}
        initialData={editingDive}
        onClose={() => { setDiveFormOpen(false); setEditingDive(undefined); }}
        onSaved={() => { setDiveFormOpen(false); setEditingDive(undefined); refresh(); }}
        onDelete={undefined}
      />
    </SafeAreaView>
  );
}
