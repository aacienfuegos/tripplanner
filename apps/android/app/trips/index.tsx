import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTrips, deleteTrip, countTrips, Trip } from "@/db/trips";
import { usePro, FREE_TRIP_LIMIT } from "@/contexts/ProContext";

export default function TripsListScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [trips, setTrips] = useState<Trip[]>([]);

  useFocusEffect(
    useCallback(() => {
      setTrips(listTrips());
    }, [])
  );

  function handleNew() {
    if (!isPro && countTrips() >= FREE_TRIP_LIMIT) {
      Alert.alert(
        "Versión gratuita",
        `La versión gratuita solo permite ${FREE_TRIP_LIMIT} viaje. Actualiza a Pro para añadir viajes ilimitados.`,
        [{ text: "Entendido" }]
      );
      return;
    }
    router.push("/trips/new");
  }

  function handleDelete(id: number, name: string) {
    Alert.alert(
      "Eliminar viaje",
      `¿Eliminar "${name}" y todos sus datos?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            deleteTrip(id);
            setTrips(listTrips());
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={trips}
        keyExtractor={(t) => String(t.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-24">
            <Ionicons name="airplane-outline" size={48} color="#9ca3af" />
            <Text className="mt-4 text-lg font-semibold text-gray-500">
              Sin viajes todavía
            </Text>
            <Text className="mt-1 text-sm text-gray-400 text-center px-8">
              Pulsa el botón + para crear tu primer viaje
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
            onPress={() => router.push(`/trips/${item.id}`)}
            onLongPress={() => handleDelete(item.id, item.name)}
          >
            <Text className="text-base font-semibold text-gray-900">
              {item.name}
            </Text>
            {item.description ? (
              <Text className="mt-1 text-sm text-gray-500" numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
            {item.start_date ? (
              <Text className="mt-2 text-xs text-gray-400">
                {item.start_date.slice(0, 10)}
                {item.end_date ? ` → ${item.end_date.slice(0, 10)}` : ""}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />

      {!isPro && trips.length >= FREE_TRIP_LIMIT && (
        <View className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Text className="text-xs text-amber-700 text-center">
            Versión gratuita · 1 viaje máximo · Actualiza a Pro para ilimitados
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleNew}
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
