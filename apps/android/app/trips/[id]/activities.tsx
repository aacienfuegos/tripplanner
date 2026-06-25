import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listActivities, deleteActivity, Activity } from "@/db/activities";
import ImportWizard from "@/components/import/ImportWizard";
import ActivityFormModal from "@/components/forms/ActivityFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";

const COLOR = "#f97316";
const COLOR_BG = "#f9731618";

const TYPE_LABELS: Record<string, string> = {
  ACTIVITY: "Actividad", RESTAURANT: "Restaurante", MUSEUM: "Museo",
  TOUR: "Tour", TRANSPORT: "Transporte", SHOW: "Espectáculo", OTHER: "Otro",
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: "#f1f5f9", text: "#64748b" },
  RESERVED:  { bg: "#fef9c3", text: "#854d0e" },
  CONFIRMED: { bg: "#dcfce7", text: "#166534" },
  CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente", RESERVED: "Reservado", CONFIRMED: "Confirmado", CANCELLED: "Cancelado",
};

function formatDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) +
    (iso.includes("T") ? "  " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "");
}

export default function ActivitiesScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<Activity[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Activity | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listActivities(tripId).then((docs) => { if (!cancelled) setItems(docs); });
    return () => { cancelled = true; };
  }, [tripId]));

  function openEdit(item: Activity) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { listActivities(tripId).then(setItems); }

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
              <Ionicons name="walk-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700">Sin actividades</Text>
            <Text className="mt-1 text-xs text-slate-400 text-center px-8">
              Usa ✨ en el header para importar desde un itinerario
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusStyle = STATUS_COLORS[item.status] ?? STATUS_COLORS.PENDING;
          return (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              onLongPress={() => Alert.alert(item.name, undefined, [
                { text: "Editar", onPress: () => openEdit(item) },
                { text: "Eliminar", style: "destructive", onPress: () => { deleteActivity(item.id); refresh(); } },
                { text: "Cancelar", style: "cancel" },
              ])}
              className="bg-white rounded-2xl mb-3 overflow-hidden shadow-sm"
              style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
              activeOpacity={0.75}
            >
              <View className="px-4 py-3.5">
                <View className="flex-row items-start justify-between mb-1">
                  <Text className="text-base font-bold text-slate-900 flex-1 mr-2" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: statusStyle.bg }}>
                    <Text className="text-xs font-semibold" style={{ color: statusStyle.text }}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2 mb-2">
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: COLOR_BG }}>
                    <Ionicons name="pricetag-outline" size={10} color={COLOR} />
                  </View>
                  <Text className="text-xs text-slate-500">{TYPE_LABELS[item.type] ?? item.type}</Text>
                  {item.city && <Text className="text-xs text-slate-400">· {item.city}</Text>}
                </View>

                {item.scheduled_at && (
                  <Text className="text-xs text-slate-400">{formatDatetime(item.scheduled_at)}</Text>
                )}

                {item.price != null && (
                  <View className="mt-2 pt-2 border-t border-slate-50 flex-row justify-end">
                    <Text className="text-sm font-semibold text-slate-800">{item.price.toFixed(2)} €</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <ActivityFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteActivity(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
