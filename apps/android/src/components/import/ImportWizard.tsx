/**
 * ImportWizard — modal de 3 pasos para importar datos vía IA.
 * Equivalente al ImportWizard.tsx de la web pero para React Native.
 *
 * Flujo:
 *   Paso 1 (PromptStep)  — copiar el prompt al portapapeles para pegarlo en Claude/ChatGPT
 *   Paso 2 (PasteStep)   — pegar el JSON que devuelve la IA
 *   Paso 3 (ReviewStep)  — revisar ítems, marcar duplicados, confirmar importación
 */
import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ImportPayload } from "@tripplanner/shared";
import PromptStep from "./PromptStep";
import PasteStep from "./PasteStep";
import ReviewStep from "./ReviewStep";

type Step = "prompt" | "paste" | "review";

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImportWizard({ tripId, visible, onClose }: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [payload, setPayload] = useState<ImportPayload | null>(null);

  function handleClose() {
    setStep("prompt");
    setPayload(null);
    onClose();
  }

  const STEP_TITLES: Record<Step, string> = {
    prompt: "1 · Copiar prompt",
    paste:  "2 · Pegar resultado",
    review: "3 · Revisar e importar",
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Text className="text-base font-semibold text-gray-900">
            {STEP_TITLES[step]}
          </Text>
          <TouchableOpacity onPress={handleClose} className="p-1">
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View className="flex-1">
          {step === "prompt" && (
            <PromptStep
              tripId={tripId}
              onNext={() => setStep("paste")}
            />
          )}
          {step === "paste" && (
            <PasteStep
              onBack={() => setStep("prompt")}
              onNext={(p) => { setPayload(p); setStep("review"); }}
            />
          )}
          {step === "review" && payload && (
            <ReviewStep
              tripId={tripId}
              payload={payload}
              onBack={() => setStep("paste")}
              onDone={handleClose}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
