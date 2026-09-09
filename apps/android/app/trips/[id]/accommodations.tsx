import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listAccommodations, deleteAccommodation, Accommodation } from "@/db/accommodations";
import ImportWizard from "@/components/import/ImportWizard";
import AccommodationFormModal from "@/components/forms/AccommodationFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";
import { useTripLock } from "@/contexts/TripLockContext";

const COLOR = "#0d9488";
const COLOR_BG = "#0d948818";

const TYPE_LABELS: Record<string, string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", APARTMENT: "Apartamento",
  AIRBNB: "Airbnb", CAMPSITE: "Camping", OTHER: "Otro",
};

function formatDate(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function AccommodationsScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t, lang } = useT();
  const { isLocked, guard } = useTripLock();
  const [items, setItems] = useState<Accommodation[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Accommodation | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listAccommodations(tripId).then((docs) => { if (!cancelled) setItems(docs); });
    return () => { cancelled = true; };
  }, [tripId]));

  function openEdit(item: Accommodation) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { listAccommodations(tripId).then(setItems); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.accommodations,
        headerRight: () => (
          <SectionHeaderRight
            tripId={id!} onImportPress={() => setImportOpen(true)}
            locked={isLocked} onLockedPress={() => guard(() => {})}
          />
        ),
      }} />

      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="bed-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noAccommodations}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noAccommodationsHint}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => guard(() => openEdit(item))}
            onLongPress={() => guard(() => Alert.alert(item.name, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.delete, style: "destructive", onPress: () => { deleteAccommodation(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ]))}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-start justify-between mb-1">
                <Text className="text-base font-bold text-slate-900 dark:text-white flex-1 mr-2" numberOfLines={1}>
                  {item.name}
                </Text>
                <View className="rounded-full px-2.5 py-0.5 flex-shrink-0" style={{ backgroundColor: COLOR_BG }}>
                  <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </Text>
                </View>
              </View>

              {item.city ? (
                <View className="flex-row items-center gap-1.5 mb-2">
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: COLOR_BG }}>
                    <Ionicons name="location-outline" size={11} color={COLOR} />
                  </View>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">{item.city}</Text>
                </View>
              ) : null}

              <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                <Text className="text-xs text-slate-400 dark:text-slate-500">{t.checkIn}: <Text className="text-slate-600 dark:text-slate-300">{formatDate(item.check_in, lang)}</Text></Text>
                {item.check_out && (
                  <>
                    <Ionicons name="arrow-forward" size={10} color="#cbd5e1" />
                    <Text className="text-xs text-slate-400 dark:text-slate-500">{t.checkOut}: <Text className="text-slate-600 dark:text-slate-300">{formatDate(item.check_out, lang)}</Text></Text>
                  </>
                )}
              </View>

              {(item.booking_ref || item.price != null) && (
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-zinc-800">
                  {item.booking_ref
                    ? <Text className="text-xs text-slate-400 dark:text-slate-500">Ref: <Text className="font-medium text-slate-600 dark:text-slate-300">{item.booking_ref}</Text></Text>
                    : <View />
                  }
                  {item.price != null && (
                    <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.price.toFixed(2)} €</Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={() => guard(openAdd)} color={COLOR} locked={isLocked} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <AccommodationFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteAccommodation(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
