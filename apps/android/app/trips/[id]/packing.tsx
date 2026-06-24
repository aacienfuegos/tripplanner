import { useState, useCallback } from "react";
import { View, Text, SectionList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listPackingItems, deletePackingItem, togglePacked, PackingItem } from "@/db/packing";
import ImportWizard from "@/components/import/ImportWizard";
import PackingFormModal from "@/components/forms/PackingFormModal";

function groupByCategory(items: PackingItem[]) {
  const map = new Map<string, PackingItem[]>();
  for (const item of items) {
    const existing = map.get(item.category) ?? [];
    existing.push(item);
    map.set(item.category, existing);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function PackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(useCallback(() => { setItems(listPackingItems(tripId)); }, [tripId]));

  const sections = groupByCategory(items);
  const packedCount = items.filter((i) => i.packed).length;

  function handleDelete(itemId: number, name: string) {
    Alert.alert("Eliminar ítem", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deletePackingItem(itemId); setItems(listPackingItems(tripId));
      }},
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      {items.length > 0 && (
        <View className="mx-4 mt-4 p-3 bg-green-50 border border-green-100 rounded-xl">
          <Text className="text-center text-sm text-green-800">
            {packedCount} / {items.length} ítems empacados
          </Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="briefcase-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Lista de maleta vacía</Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-3">
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => { togglePacked(item.id, !item.packed); setItems(listPackingItems(tripId)); }}
            onLongPress={() => handleDelete(item.id, item.name)}
            className="bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100 shadow-sm flex-row items-center gap-3"
          >
            <View className={`w-5 h-5 rounded border-2 items-center justify-center ${item.packed ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
              {item.packed ? <Ionicons name="checkmark" size={12} color="white" /> : null}
            </View>
            <Text className={`flex-1 text-base ${item.packed ? "line-through text-gray-400" : "text-gray-900"}`}>
              {item.name}
              {item.quantity > 1 ? ` ×${item.quantity}` : ""}
            </Text>
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
        onClose={() => { setImportOpen(false); setItems(listPackingItems(tripId)); }}
      />
      <PackingFormModal
        tripId={tripId} visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setItems(listPackingItems(tripId)); }}
      />
    </SafeAreaView>
  );
}
