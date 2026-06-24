import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listFlights, deleteFlight, Flight } from "@/db/flights";
import ImportWizard from "@/components/import/ImportWizard";
import FlightFormModal from "@/components/forms/FlightFormModal";

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

  useFocusEffect(
    useCallback(() => {
      setFlights(listFlights(tripId));
    }, [tripId])
  );

  function handleDelete(flightId: number, label: string) {
    Alert.alert("Eliminar vuelo", `¿Eliminar "${label}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          deleteFlight(flightId);
          setFlights(listFlights(tripId));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <FlatList
        data={flights}
        keyExtractor={(f) => String(f.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="airplane-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin vuelos añadidos</Text>
            <Text className="mt-1 text-xs text-gray-400">
              Usa el botón importar IA para añadir desde una reserva
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() =>
              handleDelete(item.id, `${item.airline ?? ""} ${item.flight_number ?? item.origin}`)
            }
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900">
                {item.origin} → {item.destination}
              </Text>
              <View className="bg-blue-100 px-2 py-0.5 rounded">
                <Text className="text-xs text-blue-700 font-medium">
                  {item.class}
                </Text>
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
              <Text className="mt-1 text-xs text-gray-400">
                Ref: {item.booking_ref}
              </Text>
            )}
            {item.price != null && (
              <Text className="mt-1 text-sm font-medium text-gray-700">
                {item.price.toFixed(2)} €
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      <View className="flex-row mx-4 mb-4 gap-3">
        <TouchableOpacity
          onPress={() => setImportOpen(true)}
          className="flex-1 bg-blue-600 rounded-xl py-3 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="sparkles-outline" size={18} color="white" />
          <Text className="text-white font-semibold">Importar vía IA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFormOpen(true)}
          className="w-12 bg-white border border-gray-300 rounded-xl items-center justify-center"
        >
          <Ionicons name="add" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      <ImportWizard
        tripId={tripId}
        visible={importOpen}
        onClose={() => {
          setImportOpen(false);
          setFlights(listFlights(tripId));
        }}
      />
      <FlightFormModal
        tripId={tripId}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setFlights(listFlights(tripId)); }}
      />
    </SafeAreaView>
  );
}
