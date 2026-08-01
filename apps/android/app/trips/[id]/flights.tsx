import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listFlights, deleteFlight, Flight } from "@/db/flights";
import ImportWizard from "@/components/import/ImportWizard";
import FlightFormModal from "@/components/forms/FlightFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#2563eb";
const COLOR_BG = "#2563eb18";

const CLASS_LABELS: Record<string, string> = {
  ECONOMY: "Economy", PREMIUM_ECONOMY: "Prem. Eco", BUSINESS: "Business", FIRST: "Primera",
};

function formatDatetime(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" }) + "  " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function FlightsScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t, lang } = useT();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listFlights(tripId).then((f) => { if (!cancelled) setFlights(f); });
    return () => { cancelled = true; };
  }, [tripId]));

  function openEdit(f: Flight) { setEditingFlight(f); setFormOpen(true); }
  function openAdd() { setEditingFlight(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingFlight(undefined); }
  function refresh() { listFlights(tripId).then(setFlights); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.flights,
        headerRight: () => <SectionHeaderRight tripId={id!} onImportPress={() => setImportOpen(true)} />,
      }} />

      <FlatList
        data={flights}
        keyExtractor={(f) => String(f.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="airplane-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noFlights}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noFlightsHint}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => Alert.alert(
              [item.airline, item.flight_number].filter(Boolean).join(" ") || `${item.origin}→${item.destination}`,
              undefined,
              [
                { text: t.edit, onPress: () => openEdit(item) },
                { text: t.delete, style: "destructive", onPress: () => { deleteFlight(item.id); refresh(); } },
                { text: t.cancel, style: "cancel" },
              ]
            )}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-lg font-bold text-slate-900 dark:text-white">
                  {item.origin}  →  {item.destination}
                </Text>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                  <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                    {CLASS_LABELS[item.class] ?? item.class}
                  </Text>
                </View>
              </View>

              {(item.airline || item.flight_number) && (
                <View className="flex-row items-center gap-1.5 mb-2">
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: COLOR_BG }}>
                    <Ionicons name="airplane" size={11} color={COLOR} />
                  </View>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">
                    {[item.airline, item.flight_number].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-3">
                <Text className="text-xs text-slate-400 dark:text-slate-500">{formatDatetime(item.departure_at, lang)}</Text>
                {item.arrival_at && (
                  <>
                    <Ionicons name="arrow-forward" size={10} color="#cbd5e1" />
                    <Text className="text-xs text-slate-400 dark:text-slate-500">{formatDatetime(item.arrival_at, lang)}</Text>
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

      <SectionFAB onPress={openAdd} color={COLOR} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <FlightFormModal
        tripId={tripId} visible={formOpen} initialData={editingFlight}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingFlight ? () => { deleteFlight(editingFlight.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
