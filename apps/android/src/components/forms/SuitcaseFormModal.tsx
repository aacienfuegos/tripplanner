import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { SUITCASE_TYPES, parseWeightInput, weightInputValue, type SuitcaseType } from "@tripplanner/shared";
import { createSuitcase, updateSuitcase, Suitcase } from "@/db/suitcases";
import { useT } from "@/contexts/I18nContext";
import { useUnits } from "@/contexts/UnitsContext";

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialData?: Suitcase;
}

export function useSuitcaseTypeLabel() {
  const { t } = useT();
  const labels: Record<SuitcaseType, string> = {
    CABIN: t.suitcaseCabin,
    CHECKED: t.suitcaseChecked,
    BACKPACK: t.suitcaseBackpack,
    OTHER: t.suitcaseOther,
  };
  return (type: SuitcaseType) => labels[type];
}

export default function SuitcaseFormModal({ tripId, visible, onClose, onSaved, initialData }: Props) {
  const { t } = useT();
  const { unitSystem } = useUnits();
  const typeLabel = useSuitcaseTypeLabel();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [type, setType] = useState<SuitcaseType>("OTHER");
  const [weight, setWeight] = useState("");
  const [nameError, setNameError] = useState("");
  const [weightError, setWeightError] = useState("");

  const initialWeight = weightInputValue(initialData?.weight_grams ?? null, unitSystem);

  useEffect(() => {
    if (visible) {
      setName(initialData?.name ?? "");
      setType(initialData?.type ?? "OTHER");
      setWeight(initialWeight);
      setNameError("");
      setWeightError("");
    }
  }, [visible, initialData, initialWeight]);

  function handleSave() {
    const trimmed = name.trim();
    const parsed = parseWeightInput(weight, unitSystem);
    if (!trimmed) setNameError(t.nameRequired);
    if (!parsed.ok) setWeightError(t.weightInvalid);
    if (!trimmed || !parsed.ok) return;
    // The form shows the weight rounded to one decimal: saving it back untouched
    // would turn 9979 g into 10000 g.
    const weightGrams = initialData && weight === initialWeight ? initialData.weight_grams : parsed.grams;
    const data = { name: trimmed, type, weight_grams: weightGrams };
    if (initialData) updateSuitcase(tripId, initialData.id, data);
    else createSuitcase(tripId, data);
    onSaved();
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editSuitcase : t.newSuitcase}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 px-5 py-4 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.suitcaseName} *</Text>
            <TextInput
              className={inputClass} value={name}
              onChangeText={(v) => { setName(v); setNameError(""); }}
              autoFocus={!initialData}
            />
            {nameError ? <Text className="mt-1 text-xs text-red-500">{nameError}</Text> : null}
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t.type}</Text>
            <View className="flex-row flex-wrap gap-2">
              {SUITCASE_TYPES.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setType(value)}
                  className={`px-3 py-1.5 rounded-full border ${type === value ? "bg-indigo-600 border-indigo-600" : "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"}`}
                >
                  <Text className={`text-sm font-medium ${type === value ? "text-white" : "text-gray-700 dark:text-slate-300"}`}>
                    {typeLabel(value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {unitSystem === "IMPERIAL" ? t.weightLb : t.weightKg}
            </Text>
            <TextInput
              className={`${inputClass} w-32`} value={weight}
              onChangeText={(v) => { setWeight(v); setWeightError(""); }}
              keyboardType="decimal-pad"
            />
            {weightError ? <Text className="mt-1 text-xs text-red-500">{weightError}</Text> : null}
          </View>
        </View>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <TouchableOpacity onPress={handleSave} className="bg-indigo-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.save}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
