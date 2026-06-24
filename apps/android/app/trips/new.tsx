import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createTrip } from "@/db/trips";

export default function NewTripScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) {
      setError("El nombre del viaje es obligatorio");
      return;
    }
    createTrip({
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      currency,
    });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-6 gap-5">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="p.ej. Vacaciones en Japón"
                value={name}
                onChangeText={(v) => { setName(v); setError(""); }}
                autoFocus
              />
              {error ? (
                <Text className="mt-1 text-xs text-red-500">{error}</Text>
              ) : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Descripción
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Opcional"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Inicio
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Fin
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Moneda principal
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 w-24"
                placeholder="EUR"
                value={currency}
                onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                maxLength={3}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </ScrollView>

        <View className="px-5 pb-6 gap-3">
          <TouchableOpacity
            onPress={handleCreate}
            className="bg-blue-600 rounded-xl py-3.5 items-center"
          >
            <Text className="text-white font-semibold text-base">
              Crear viaje
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="py-3 items-center"
          >
            <Text className="text-gray-500 text-sm">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
