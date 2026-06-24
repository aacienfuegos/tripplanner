import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listAccommodations, deleteAccommodation, Accommodation } from "@/db/accommodations";
import ImportWizard from "@/components/import/ImportWizard";
import AccommodationFormModal from "@/components/forms/AccommodationFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";

const TYPE_LABELS: Record<Accommodation["type"], string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", AIRBNB: "Airbnb",
  APARTMENT: "Apartamento", RESORT: "Resort", OTHER: "Otro",
};

export default function AccommodationsScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<Accommodation[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Accommodation | undefined>();

  useFocusEffect(useCallback(() => { setItems(listAccommodations(tripId)); }, [tripId]));

  function handleDelete(item: Accommodation) {
    Alert.alert("Eliminar alojamiento", `¿Eliminar "${item.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteAccommodation(item.id); setItems(listAccommodations(tripId));
      }},
    ]);
  }

  function openEdit(item: Accommodation) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { setItems(listAccommodations(tripId)); }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => (
          <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />
        ),
      }} />
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
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
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

      <View className="mx-4 mb-4">
        <TouchableOpacity
          onPress={openAdd}
          className="bg-purple-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-semibold text-base">Añadir alojamiento</Text>
        </TouchableOpacity>
      </View>

      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); refresh(); }}
      />
      <AccommodationFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteAccommodation(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
