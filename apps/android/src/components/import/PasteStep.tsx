/**
 * Paso 2 del wizard: el usuario pega el JSON que generó la IA.
 * Valida con importPayloadSchema y pasa el payload al paso 3.
 */
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
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { importPayloadSchema, ImportPayload } from "@tripplanner/shared";

interface Props {
  onBack: () => void;
  onNext: (payload: ImportPayload) => void;
}

// Un JSON de itinerario legítimo (6 secciones, decenas de items) pesa unos
// pocos KB. 1MB de margen cubre viajes muy grandes sin permitir que un
// payload manipulado o pegado por error congele el hilo JS (ANR) en
// JSON.parse/safeParse — issue #180.
const MAX_PASTE_LENGTH = 1_000_000;

export default function PasteStep({ onBack, onNext }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function handlePasteFromClipboard() {
    const clip = await Clipboard.getStringAsync();
    setText(clip);
    setError("");
  }

  function handleValidate() {
    setError("");
    const trimmed = text.trim();
    if (trimmed.length > MAX_PASTE_LENGTH) {
      setError(
        `El JSON es demasiado grande (${Math.round(trimmed.length / 1024)} KB). El límite es ${Math.round(MAX_PASTE_LENGTH / 1024)} KB — revisa que no hayas pegado contenido de más.`
      );
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      setError("El texto no es JSON válido. Asegúrate de copiar solo el JSON que generó la IA.");
      return;
    }
    const result = importPayloadSchema.safeParse(raw);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setError(`JSON inválido: ${firstIssue.path.join(".")} — ${firstIssue.message}`);
      return;
    }
    const total = Object.values(result.data).reduce((s, arr) => s + arr.length, 0);
    if (total === 0) {
      setError("La IA no encontró datos en el contenido. Asegúrate de incluir el texto de la reserva en el prompt.");
      return;
    }
    onNext(result.data);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <View className="flex-1">
        <View className="px-4 py-4 bg-amber-50 border-b border-amber-100">
          <Text className="text-sm text-amber-800">
            Pega aquí el JSON que te devolvió la IA. Debe empezar por <Text className="font-mono font-bold">{"{"}</Text>
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          <TextInput
            className="border border-gray-300 rounded-xl p-3 text-sm font-mono text-gray-800 bg-gray-50 min-h-48"
            multiline
            placeholder={'{\n  "flights": [...],\n  "accommodations": [...]\n}'}
            value={text}
            onChangeText={(v) => { setText(v); setError(""); }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {error ? (
            <View className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="px-4 pb-6 gap-3">
          <TouchableOpacity
            onPress={handlePasteFromClipboard}
            className="border border-gray-300 rounded-xl py-3 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="clipboard-outline" size={18} color="#374151" />
            <Text className="text-gray-700 font-medium">Pegar del portapapeles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleValidate}
            disabled={!text.trim()}
            className={`rounded-xl py-3.5 items-center ${text.trim() ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <Text className={`font-semibold text-base ${text.trim() ? "text-white" : "text-gray-400"}`}>
              Validar y continuar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} className="py-2 items-center">
            <Text className="text-gray-500 text-sm">← Volver al prompt</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
