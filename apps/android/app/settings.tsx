import { View, Text, Switch, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePro } from "@/contexts/ProContext";

export default function SettingsScreen() {
  const { isPro, setIsPro } = usePro();

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <Stack.Screen options={{ title: "Ajustes", headerShown: true }} />
      <ScrollView className="flex-1">

        {/* Plan */}
        <View className="mx-4 mt-6 bg-white rounded-2xl overflow-hidden shadow-sm">
          <View className="px-4 py-3 border-b border-slate-50">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</Text>
          </View>

          <View className="px-4 py-4">
            {isPro ? (
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 bg-blue-50 rounded-2xl items-center justify-center">
                  <Ionicons name="star" size={22} color="#2563eb" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-900">TripPlanner Pro</Text>
                  <Text className="text-sm text-slate-500">Viajes ilimitados</Text>
                </View>
                <View className="bg-blue-50 rounded-full px-3 py-1">
                  <Text className="text-xs font-semibold text-blue-600">Activo</Text>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-11 h-11 bg-slate-100 rounded-2xl items-center justify-center">
                    <Ionicons name="person-outline" size={22} color="#64748b" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-slate-900">Plan gratuito</Text>
                    <Text className="text-sm text-slate-500">Hasta 1 viaje</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    "Próximamente",
                    "La compra de Pro estará disponible cuando la app se publique en Google Play.",
                    [{ text: "Entendido" }]
                  )}
                  className="rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: "#2563eb" }}
                >
                  <Ionicons name="star-outline" size={18} color="white" />
                  <Text className="text-white font-bold text-base">Actualizar a Pro</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* DEV toggle */}
        {__DEV__ && (
          <View className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="code-slash-outline" size={16} color="#92400e" />
              <Text className="text-xs font-semibold text-amber-800">DEV — Simular plan Pro</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-amber-700">isPro</Text>
              <Switch
                value={isPro}
                onValueChange={setIsPro}
                trackColor={{ false: "#d1d5db", true: "#2563eb" }}
              />
            </View>
          </View>
        )}

        {/* Sobre la app */}
        <View className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden shadow-sm">
          <View className="px-4 py-3 border-b border-slate-50">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Información</Text>
          </View>
          <View className="px-4 py-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-slate-700">Versión</Text>
              <Text className="text-sm text-slate-400">1.0.0</Text>
            </View>
            <View className="flex-row items-center gap-2 pt-1 border-t border-slate-50">
              <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
              <Text className="text-xs text-slate-400">Todos tus datos se guardan localmente en tu dispositivo.</Text>
            </View>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
