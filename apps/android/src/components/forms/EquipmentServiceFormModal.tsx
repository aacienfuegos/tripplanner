import { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { createEquipmentService } from "@/db/dive-equipment";
import DatePickerInput from "@/components/DatePickerInput";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  equipmentId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function EquipmentServiceFormModal({ visible, equipmentId, onClose, onSaved }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setCost("");
      setNotes("");
      setError("");
    }
  }, [visible]);

  function handleSave() {
    if (!date) { setError(t.equipmentServiceDate); return; }
    if (!description.trim()) { setError(t.equipmentServiceDescription); return; }
    createEquipmentService(equipmentId, {
      date, description: description.trim(),
      cost: cost ? parseFloat(cost) : null,
      notes: notes.trim() || null,
    });
    onSaved();
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";
  const label = "text-sm font-medium text-gray-700 dark:text-slate-300 mb-1";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t.equipmentAddService}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 px-5 py-4 gap-4">
          <View>
            <Text className={label}>{t.equipmentServiceDate} *</Text>
            <DatePickerInput value={date} onChange={setDate} />
          </View>
          <View>
            <Text className={label}>{t.equipmentServiceDescription} *</Text>
            <TextInput className={inputClass} value={description} onChangeText={(v) => { setDescription(v); setError(""); }} autoFocus />
            {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
          </View>
          <View>
            <Text className={label}>{t.equipmentServiceCost}</Text>
            <TextInput className={inputClass} value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
          </View>
          <View>
            <Text className={label}>{t.notes}</Text>
            <TextInput className={inputClass} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
          </View>
        </View>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <TouchableOpacity onPress={handleSave} className="bg-cyan-700 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.save}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
