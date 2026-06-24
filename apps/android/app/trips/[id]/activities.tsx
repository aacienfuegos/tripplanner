import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listActivities, deleteActivity, Activity } from "@/db/activities";
import ImportWizard from "@/components/import/ImportWizard";

const STATUS_BG: Record<Activity["status"], string> = {
  PENDING: "bg-gray-100",
  RESERVED: "bg-blue-100",
  CONFIRMED: "bg-green-100",
  CANCELLED: "bg-red-100",
};
const STATUS_TEXT: Record<Activity["status"], string> = {
  PENDING: "text-gray-600",
  RESERVED: "text-blue-700",
  CONFIRMED: "text-green-700",
  CANCELLED: "text-red-700",
};
const STATUS_LABELS: Record<Activity["status"], string> = {
  PENDING: "Pendiente", RESERVED: "Reservado",
  CONFIRMED: "Confirmado", CANCELLED: "Cancelado",
};

export default function ActivitiesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<Activity[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  useFocusEffect(useCallback(() => { setItems(listActivities(tripId)); }, [tripId]));

  function handleDelete(itemId: number, name: string) {
    Alert.alert("Eliminar actividad", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteActivity(itemId); setItems(listActivities(tripId));
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
            <Ionicons name="walk-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin actividades añadidas</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleDelete(item.id, item.name)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900 flex-1 mr-2">{item.name}</Text>
              <View className={`px-2 py-0.5 rounded ${STATUS_BG[item.status as Activity["status"]]}`}>
                <Text className={`text-xs ${STATUS_TEXT[item.status as Activity["status"]]}`}>
                  {STATUS_LABELS[item.status]}
                </Text>
              </View>
            </View>
            {item.location && (
              <Text className="mt-1 text-sm text-gray-600">{item.location}</Text>
            )}
            {item.scheduled_at && (
              <Text className="mt-1 text-xs text-gray-400">
                {item.scheduled_at.slice(0, 16).replace("T", " ")}
                {item.duration ? ` · ${item.duration} min` : ""}
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
      <TouchableOpacity
        onPress={() => setImportOpen(true)}
        className="mx-4 mb-4 bg-blue-600 rounded-xl py-3 flex-row items-center justify-center gap-2"
      >
        <Ionicons name="sparkles-outline" size={18} color="white" />
        <Text className="text-white font-semibold">Importar vía IA</Text>
      </TouchableOpacity>
      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); setItems(listActivities(tripId)); }}
      />
    </SafeAreaView>
  );
}
