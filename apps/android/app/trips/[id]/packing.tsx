import { useState, useCallback } from "react";
import { View, Text, SectionList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listPackingItems, deletePackingItem, togglePacked, PackingItem } from "@/db/packing";
import ImportWizard from "@/components/import/ImportWizard";
import PackingFormModal from "@/components/forms/PackingFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";

const COLOR = "#4f46e5";
const COLOR_BG = "#4f46e518";

function groupByCategory(items: PackingItem[]) {
  const map = new Map<string, PackingItem[]>();
  for (const item of items) {
    const arr = map.get(item.category) ?? [];
    arr.push(item);
    map.set(item.category, arr);
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
  const packed = items.filter((i) => i.packed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

  function handleLongPress(item: PackingItem) {
    Alert.alert(item.name, undefined, [
      { text: "Editar", onPress: () => { setEditingItem(item); setFormOpen(true); } },
      { text: "Eliminar", style: "destructive", onPress: () => { deletePackingItem(item.id); setItems(listPackingItems(tripId)); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { setItems(listPackingItems(tripId)); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />,
      }} />

      {total > 0 && (
        <View className="mx-4 mt-3 bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-slate-700">Maleta preparada</Text>
            <Text className="text-sm font-bold" style={{ color: pct === 100 ? "#059669" : COLOR }}>
              {packed}/{total}  ·  {pct}%
            </Text>
          </View>
          <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? "#059669" : COLOR,
              }}
            />
          </View>
          {pct === 100 && (
            <Text className="text-xs text-emerald-600 font-medium mt-1.5">¡Todo listo para el viaje!</Text>
          )}
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="briefcase-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700">Lista de maleta vacía</Text>
            <Text className="mt-1 text-xs text-slate-400 text-center px-8">
              Añade ítems o usa ✨ para importarlos desde un itinerario
            </Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 px-1">
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => { setEditingItem(item); setFormOpen(true); }}
            onLongPress={() => handleLongPress(item)}
            className="bg-white rounded-2xl mb-2 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: item.packed ? "#d1fae5" : COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3 flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => { togglePacked(item.id, !item.packed); refresh(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className={`w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0 ${item.packed ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}
              >
                {item.packed ? <Ionicons name="checkmark" size={11} color="white" /> : null}
              </TouchableOpacity>
              <Text className={`flex-1 text-base ${item.packed ? "line-through text-slate-400" : "text-slate-900 font-medium"}`}>
                {item.name}{item.quantity > 1 ? <Text className="text-slate-400 font-normal"> ×{item.quantity}</Text> : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <PackingFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deletePackingItem(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
