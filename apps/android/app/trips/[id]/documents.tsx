import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDocuments, deleteDocument, Document } from "@/db/documents";
import ImportWizard from "@/components/import/ImportWizard";

const TYPE_LABELS: Record<Document["type"], string> = {
  PASSPORT: "Pasaporte", VISA: "Visa", INSURANCE: "Seguro",
  TICKET: "Billete", VOUCHER: "Voucher", OTHER: "Otro",
};
const TYPE_ICONS: Record<Document["type"], string> = {
  PASSPORT: "card-outline", VISA: "globe-outline", INSURANCE: "shield-checkmark-outline",
  TICKET: "ticket-outline", VOUCHER: "pricetag-outline", OTHER: "document-outline",
};

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000; // 90 days
}

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [items, setItems] = useState<Document[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  useFocusEffect(useCallback(() => { setItems(listDocuments(tripId)); }, [tripId]));

  function handleDelete(itemId: number, name: string) {
    Alert.alert("Eliminar documento", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteDocument(itemId); setItems(listDocuments(tripId));
      }},
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(d) => String(d.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="document-text-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin documentos añadidos</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleDelete(item.id, item.name)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm flex-row items-center gap-3"
          >
            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
              <Ionicons name={TYPE_ICONS[item.type] as any} size={20} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-gray-900">{item.name}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[item.type]}</Text>
              {item.expires_at && (
                <Text className={`text-xs mt-0.5 ${isExpiringSoon(item.expires_at) ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                  Caduca: {item.expires_at.slice(0, 10)}
                  {isExpiringSoon(item.expires_at) ? " ⚠️" : ""}
                </Text>
              )}
            </View>
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
        onClose={() => { setImportOpen(false); setItems(listDocuments(tripId)); }}
      />
    </SafeAreaView>
  );
}
