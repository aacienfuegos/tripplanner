import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listAccommodations, deleteAccommodation, Accommodation } from "@/db/accommodations";
import ImportWizard from "@/components/import/ImportWizard";
import AccommodationFormModal from "@/components/forms/AccommodationFormModal";

const TYPE_LABELS: Record<Accommodation["type"], string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", AIRBNB: "Airbnb",
  APARTMENT: "Apartamento", RESORT: "Resort", OTHER: "Otro",
};

export default function AccommodationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<Accommodation[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(useCallback(() => { setItems(listAccommodations(tripId)); }, [tripId]));

  function handleDelete(itemId: number, name: string) {
    Alert.alert("Eliminar alojamiento", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteAccommodation(itemId); setItems(listAccommodations(tripId));
      }},
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="bed-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin alojamientos añadidos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleDelete(item.id, item.name)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900 flex-1 mr-2">{item.name}</Text>
              <View className="bg-purple-100 px-2 py-0.5 rounded">
                <Text className="text-xs text-purple-700">{TYPE_LABELS[item.type as Accommodation["type"]]}</Text>
              </View>
            </View>
            <Text className="mt-1 text-sm text-gray-600">{item.city}</Text>
            {(item.check_in || item.check_out) && (
              <Text className="mt-1 text-xs text-gray-400">
                {item.check_in?.slice(0, 10) ?? "?"} → {item.check_out?.slice(0, 10) ?? "?"}
              </Text>
            )}
            {item.price_per_night != null && (
              <Text className="mt-1 text-sm font-medium text-gray-700">
                {item.price_per_night.toFixed(2)} €/noche
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
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); setItems(listAccommodations(tripId)); }}
      />
      <AccommodationFormModal
        tripId={tripId} visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setItems(listAccommodations(tripId)); }}
      />
    </SafeAreaView>
  );
}
