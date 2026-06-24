/**
 * Pantalla de ajustes. En producción mostrará el estado de la suscripción Pro
 * y el botón para comprar. Por ahora incluye un toggle dev para simular isPro.
 */
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePro } from "@/contexts/ProContext";

export default function SettingsScreen() {
  const { isPro, setIsPro } = usePro();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: "Ajustes", headerShown: true }} />
      <ScrollView className="flex-1">
        <View className="mx-4 mt-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <View className="px-4 py-3 border-b border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Plan
            </Text>
          </View>

          <View className="px-4 py-4">
            {isPro ? (
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                  <Text className="text-xl">⭐</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">TripPlanner Pro</Text>
                  <Text className="text-sm text-gray-500">Viajes ilimitados</Text>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                    <Text className="text-xl">🆓</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">Plan gratuito</Text>
                    <Text className="text-sm text-gray-500">1 viaje</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      "Próximamente",
                      "La compra de Pro estará disponible cuando la app se publique en Google Play.",
                      [{ text: "Entendido" }]
                    )
                  }
                  className="bg-blue-600 rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-semibold">Actualizar a Pro</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Toggle solo visible en desarrollo */}
        {__DEV__ && (
          <View className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Text className="text-xs font-semibold text-amber-800 mb-3">
              DEV — Simular plan Pro
            </Text>
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

        <View className="mx-4 mt-4 mb-8">
          <Text className="text-xs text-gray-400 text-center">
            TripPlanner · v1.0.0{"\n"}
            Todos tus datos se guardan localmente en tu dispositivo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
