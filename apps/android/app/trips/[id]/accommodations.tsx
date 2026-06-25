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

const COLOR = "#0d9488";
const COLOR_BG = "#0d948818";

const TYPE_LABELS: Record<string, string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", APARTMENT: "Apartamento",
  AIRBNB: "Airbnb", RESORT: "Resort", OTHER: "Otro",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccommodationsScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
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
    <SafeAreaView className="flex-1 bg-zinc-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />,
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
            <Text className="text-base font-semibold text-slate-700">Sin alojamientos</Text>
            <Text className="mt-1 text-xs text-slate-400 text-center px-8">
              Usa ✨ en el header para importar desde una reserva
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => Alert.alert(item.name, undefined, [
              { text: "Editar", onPress: () => openEdit(item) },
              { text: "Eliminar", style: "destructive", onPress: () => { deleteAccommodation(item.id); refresh(); } },
              { text: "Cancelar", style: "cancel" },
            ])}
            className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
                  {item.name}
                </Text>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                  <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </Text>
                </View>
              </View>

              {item.city && (
                <View className="flex-row items-center gap-1.5 mb-2">
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: COLOR_BG }}>
                    <Ionicons name="location-outline" size={11} color={COLOR} />
                  </View>
                  <Text className="text-sm text-slate-500">{item.city}</Text>
                </View>
              )}

              {(item.check_in || item.check_out) && (
                <Text className="text-xs text-slate-400">
                  {formatDate(item.check_in)} → {formatDate(item.check_out)}
                </Text>
              )}

              {(item.booking_ref || item.price != null) && (
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  {item.booking_ref
                    ? <Text className="text-xs text-slate-400">Ref: <Text className="font-medium text-slate-600">{item.booking_ref}</Text></Text>
                    : <View />}
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
      <AccommodationFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteAccommodation(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
