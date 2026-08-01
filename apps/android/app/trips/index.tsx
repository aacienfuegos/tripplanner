import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTrips, deleteTrip, countTrips, getTripSummary, Trip } from "@/db/trips";
import { usePro, FREE_TRIP_LIMIT } from "@/contexts/ProContext";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function tripDuration(start: string, end: string): number {
  return Math.round((new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86400000) + 1;
}

function StatusChip({ status, daysUntil }: { status: string; daysUntil: number | null }) {
  let label = "";
  if (status === "ongoing") label = "En curso";
  else if (status === "upcoming" && daysUntil !== null) label = daysUntil === 0 ? "¡Hoy!" : `En ${daysUntil} día${daysUntil === 1 ? "" : "s"}`;
  else if (status === "past" && daysUntil !== null) label = `Hace ${Math.abs(daysUntil)} día${Math.abs(daysUntil) === 1 ? "" : "s"}`;
  if (!label) return null;
  return (
    <View className="self-start bg-white/20 rounded-full px-2.5 py-0.5 mt-1.5">
      <Text className="text-white/90 text-xs font-medium">{label}</Text>
    </View>
  );
}

function TripCard({ item, onPress, onLongPress }: { item: Trip; onPress: () => void; onLongPress: () => void }) {
  const summary = getTripSummary(item.id, item.currency);
  const hasDates = !!item.start_date;
  const duration = item.start_date && item.end_date
    ? tripDuration(item.start_date.slice(0, 10), item.end_date.slice(0, 10))
    : null;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.92} className="mb-4 rounded-2xl overflow-hidden shadow-md">
      <LinearGradient colors={["#2563eb", "#4338ca"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="px-5 pt-5 pb-4">
        <Text className="text-2xl font-black text-white leading-tight" numberOfLines={2}>
          {item.name}
        </Text>
        {hasDates && (
          <Text className="text-white/75 text-sm mt-1.5">
            {formatDate(item.start_date!)}
            {item.end_date ? ` → ${formatDate(item.end_date)}` : ""}
            {duration ? `  ·  ${duration} día${duration === 1 ? "" : "s"}` : ""}
          </Text>
        )}
        <StatusChip status={summary.tripStatus} daysUntil={summary.daysUntil} />
      </LinearGradient>

      <View className="bg-white px-5 py-3 flex-row items-center">
        <View className="flex-row items-center gap-3 flex-1">
          {summary.flights > 0 && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="airplane-outline" size={13} color="#64748b" />
              <Text className="text-xs text-slate-500">{summary.flights}</Text>
            </View>
          )}
          {summary.accommodations > 0 && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="bed-outline" size={13} color="#64748b" />
              <Text className="text-xs text-slate-500">{summary.accommodations}</Text>
            </View>
          )}
          {summary.activities > 0 && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="walk-outline" size={13} color="#64748b" />
              <Text className="text-xs text-slate-500">{summary.activities}</Text>
            </View>
          )}
          {summary.expensesTotal > 0 && (
            <>
              {(summary.flights > 0 || summary.accommodations > 0 || summary.activities > 0) && (
                <View className="w-px h-3 bg-slate-200" />
              )}
              <Text className="text-xs text-slate-500 font-medium">
                {summary.expensesTotal.toFixed(0)} {item.currency}
              </Text>
            </>
          )}
        </View>
        {summary.packingTotal > 0 && (
          <View className="flex-row items-center gap-2 ml-3">
            <View className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <View
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${Math.round((summary.packingPacked / summary.packingTotal) * 100)}%` }}
              />
            </View>
            <Text className="text-xs text-slate-400">
              {Math.round((summary.packingPacked / summary.packingTotal) * 100)}%
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TripsListScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [trips, setTrips] = useState<Trip[]>([]);

  useFocusEffect(useCallback(() => { setTrips(listTrips()); }, []));

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
    Alert.alert("Eliminar viaje", `¿Eliminar "${name}" y todos sus datos?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => { deleteTrip(id); setTrips(listTrips()); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <FlatList
        data={trips}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-24">
            <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="airplane-outline" size={36} color="#2563eb" />
            </View>
            <Text className="text-xl font-bold text-slate-800">Sin viajes todavía</Text>
            <Text className="mt-2 text-sm text-slate-400 text-center px-10 leading-5">
              Pulsa + para crear tu primer viaje y empieza a planificar
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TripCard
            item={item}
            onPress={() => router.push(`/trips/${item.id}`)}
            onLongPress={() => handleDelete(item.id, item.name)}
          />
        )}
      />

      {!isPro && trips.length >= FREE_TRIP_LIMIT && (
        <View className="absolute bottom-24 left-4 right-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Text className="text-xs text-amber-700 text-center">
            Versión gratuita · 1 viaje máximo · Actualiza a Pro para ilimitados
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleNew}
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
