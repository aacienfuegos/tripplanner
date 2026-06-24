import { useState, useCallback } from "react";
import { View, Text, SectionList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listPackingItems, deletePackingItem, togglePacked, PackingItem } from "@/db/packing";
import ImportWizard from "@/components/import/ImportWizard";
import PackingFormModal from "@/components/forms/PackingFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";

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
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItem | undefined>();

  useFocusEffect(useCallback(() => { setItems(listPackingItems(tripId)); }, [tripId]));

  const sections = groupByCategory(items);
  const packedCount = items.filter((i) => i.packed).length;

  function handleLongPress(item: PackingItem) {
    Alert.alert(item.name, undefined, [
      { text: "Editar", onPress: () => { setEditingItem(item); setFormOpen(true); } },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deletePackingItem(item.id); setItems(listPackingItems(tripId));
      }},
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { setItems(listPackingItems(tripId)); }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => (
          <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />
        ),
      }} />
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
            onPress={() => { setEditingItem(item); setFormOpen(true); }}
            onLongPress={() => handleLongPress(item)}
            className="bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100 shadow-sm flex-row items-center gap-3"
          >
            <TouchableOpacity
              onPress={() => { togglePacked(item.id, !item.packed); refresh(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className={`w-5 h-5 rounded border-2 items-center justify-center ${item.packed ? "bg-green-500 border-green-500" : "border-gray-300"}`}
            >
              {item.packed ? <Ionicons name="checkmark" size={12} color="white" /> : null}
            </TouchableOpacity>
            <Text className={`flex-1 text-base ${item.packed ? "line-through text-gray-400" : "text-gray-900"}`}>
              {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View className="mx-4 mb-4">
        <TouchableOpacity
          onPress={openAdd}
          className="bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-semibold text-base">Añadir ítem</Text>
        </TouchableOpacity>
      </View>

      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); refresh(); }}
      />
      <PackingFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deletePackingItem(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
