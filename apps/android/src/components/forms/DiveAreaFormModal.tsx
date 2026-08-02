import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { createDiveArea, updateDiveArea, DiveArea } from "@/db/dive-areas";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: (area: DiveArea) => void;
  onDelete?: () => void;
  initialData?: DiveArea;
}

export default function DiveAreaFormModal({ visible, onClose, onSaved, onDelete, initialData }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setName(initialData?.name ?? "");
      setCountry(initialData?.country ?? "");
      setNotes(initialData?.notes ?? "");
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!name.trim()) { setError(t.diveAreaName); return; }
    const data = { name: name.trim(), country: country.trim() || null, notes: notes.trim() || null };
    const area = initialData ? (updateDiveArea(initialData.id, data), { ...initialData, ...data }) : createDiveArea(data);
    onSaved(area);
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editDiveArea : t.addDiveArea}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 px-5 py-4 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.diveAreaName} *</Text>
            <TextInput className={inputClass} value={name} onChangeText={(v) => { setName(v); setError(""); }} autoFocus />
            {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.diveAreaCountry}</Text>
            <TextInput className={inputClass} value={country} onChangeText={setCountry} />
          </View>
        </View>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-zinc-800 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-cyan-700 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.save}</Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert(t.editDiveArea, t.confirmDeleteDiveArea, [
                { text: t.cancel, style: "cancel" },
                { text: t.delete, style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">{t.delete}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
