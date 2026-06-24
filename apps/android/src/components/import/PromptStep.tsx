/**
 * Paso 1 del wizard: genera el prompt y lo pone en el portapapeles.
 * El usuario lo pega en Claude, ChatGPT o Gemini junto con su PDF/email.
 */
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { generateImportPrompt } from "@tripplanner/shared";
import { getTrip } from "@/db/trips";

interface Props {
  tripId: number;
  onNext: () => void;
}

export default function PromptStep({ tripId, onNext }: Props) {
  const trip = getTrip(tripId);
  const prompt = generateImportPrompt({
    tripStartDate: trip?.start_date ?? undefined,
    tripEndDate: trip?.end_date ?? undefined,
  });

  async function handleCopy() {
    await Clipboard.setStringAsync(prompt);
    Alert.alert(
      "Prompt copiado",
      "Pégalo en Claude, ChatGPT o Gemini junto con tu reserva o PDF de viaje. Luego vuelve aquí con el JSON que te devuelva.",
      [{ text: "Entendido" }]
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 py-4 bg-blue-50 border-b border-blue-100">
        <Text className="text-sm text-blue-800 font-medium">Cómo funciona</Text>
        <Text className="mt-1 text-sm text-blue-700">
          1. Copia el prompt de abajo{"\n"}
          2. Pégalo en Claude, ChatGPT o Gemini{"\n"}
          3. Añade el texto de tu reserva o PDF{"\n"}
          4. Copia el JSON que te devuelva{"\n"}
          5. Vuelve aquí y pégalo en el paso 2
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-gray-300 text-xs font-mono leading-relaxed" selectable>
            {prompt}
          </Text>
        </View>
      </ScrollView>

      <View className="px-4 pb-6 gap-3">
        <TouchableOpacity
          onPress={handleCopy}
          className="bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="copy-outline" size={18} color="white" />
          <Text className="text-white font-semibold text-base">Copiar prompt</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onNext}
          className="py-3 flex-row items-center justify-center gap-1"
        >
          <Text className="text-gray-600 text-sm">Ya tengo el JSON →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
