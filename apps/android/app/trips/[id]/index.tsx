import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listFlights, deleteFlight, Flight } from "@/db/flights";
import ImportWizard from "@/components/import/ImportWizard";
import FlightFormModal from "@/components/forms/FlightFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | undefined>();

  useFocusEffect(useCallback(() => { setFlights(listFlights(tripId)); }, [tripId]));

  function handleDelete(flight: Flight) {
    Alert.alert("Eliminar vuelo", `¿Eliminar "${[flight.airline, flight.flight_number].filter(Boolean).join(" ") || flight.origin}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteFlight(flight.id); setFlights(listFlights(tripId));
      }},
    ]);
  }

  function openEdit(flight: Flight) { setEditingFlight(flight); setFormOpen(true); }
  function openAdd() { setEditingFlight(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingFlight(undefined); }
  function refresh() { setFlights(listFlights(tripId)); }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => (
          <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />
        ),
      }} />
      <FlatList
        data={flights}
        keyExtractor={(f) => String(f.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="airplane-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin vuelos añadidos</Text>
            <Text className="mt-1 text-xs text-gray-400">
              Usa el icono ✨ del header para importar desde una reserva
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900">
                {item.origin} → {item.destination}
              </Text>
              <View className="bg-blue-100 px-2 py-0.5 rounded">
                <Text className="text-xs text-blue-700 font-medium">{item.class}</Text>
              </View>
            </View>
            {(item.airline || item.flight_number) && (
              <Text className="mt-1 text-sm text-gray-600">
                {[item.airline, item.flight_number].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text className="mt-1 text-xs text-gray-400">
              {formatDate(item.departure_at)}
              {item.arrival_at ? ` → ${formatDate(item.arrival_at)}` : ""}
            </Text>
            {item.booking_ref && (
              <Text className="mt-1 text-xs text-gray-400">Ref: {item.booking_ref}</Text>
            )}
            {item.price != null && (
              <Text className="mt-1 text-sm font-medium text-gray-700">
                {item.price.toFixed(2)} €
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      <View className="mx-4 mb-4">
        <TouchableOpacity
          onPress={openAdd}
          className="bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-semibold text-base">Añadir vuelo</Text>
        </TouchableOpacity>
      </View>

      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); refresh(); }}
      />
      <FlightFormModal
        tripId={tripId} visible={formOpen} initialData={editingFlight}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingFlight ? () => { deleteFlight(editingFlight.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
