import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listFlights, deleteFlight, Flight } from "@/db/flights";
import ImportWizard from "@/components/import/ImportWizard";
import FlightFormModal from "@/components/forms/FlightFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";

const COLOR = "#2563eb";
const COLOR_BG = "#2563eb18";

const CLASS_LABELS: Record<string, string> = {
  ECONOMY: "Economy", PREMIUM_ECONOMY: "Prem. Eco", BUSINESS: "Business", FIRST: "Primera",
};

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + "  " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listFlights(tripId).then((f) => { if (!cancelled) setFlights(f); });
    return () => { cancelled = true; };
  }, [tripId]));

  function openEdit(flight: Flight) { setEditingFlight(flight); setFormOpen(true); }
  function openAdd() { setEditingFlight(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingFlight(undefined); }
  function refresh() { listFlights(tripId).then(setFlights); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />,
      }} />

      <FlatList
        data={flights}
        keyExtractor={(f) => String(f.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="airplane-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700">Sin vuelos añadidos</Text>
            <Text className="mt-1 text-xs text-slate-400 text-center px-8">
              Usa ✨ en el header para importar desde una reserva
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => Alert.alert(
              [item.airline, item.flight_number].filter(Boolean).join(" ") || `${item.origin}→${item.destination}`,
              undefined,
              [
                { text: "Editar", onPress: () => openEdit(item) },
                { text: "Eliminar", style: "destructive", onPress: () => { deleteFlight(item.id); refresh(); } },
                { text: "Cancelar", style: "cancel" },
              ]
            )}
            className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-lg font-bold text-slate-900">
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
                  <Text className="text-sm text-slate-500">
                    {[item.airline, item.flight_number].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-3">
                <Text className="text-xs text-slate-400">{formatDatetime(item.departure_at)}</Text>
                {item.arrival_at && (
                  <>
                    <Ionicons name="arrow-forward" size={10} color="#cbd5e1" />
                    <Text className="text-xs text-slate-400">{formatDatetime(item.arrival_at)}</Text>
                  </>
                )}
              </View>

              {(item.booking_ref || item.price != null) && (
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  {item.booking_ref
                    ? <Text className="text-xs text-slate-400">Ref: <Text className="font-medium text-slate-600">{item.booking_ref}</Text></Text>
                    : <View />
                  }
                  {item.price != null && (
                    <Text className="text-sm font-semibold text-slate-800">{item.price.toFixed(2)} €</Text>
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
