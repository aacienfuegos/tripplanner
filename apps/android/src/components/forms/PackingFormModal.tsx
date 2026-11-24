import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createPackingItem, updatePackingItem, PackingItem } from "@/db/packing";
import type { Suitcase } from "@/db/suitcases";
import { useT } from "@/contexts/I18nContext";

const PRESET_CATEGORIES = ["Ropa", "Higiene", "Electrónica", "Documentos", "Medicación", "Otros"];

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: PackingItem;
  suitcases: readonly Suitcase[];
}

export default function PackingFormModal({ tripId, visible, onClose, onSaved, onDelete, initialData, suitcases }: Props) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Otros");
  const [customCategory, setCustomCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [suitcaseId, setSuitcaseId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setQuantity(String(initialData.quantity));
        const isPreset = PRESET_CATEGORIES.includes(initialData.category);
        setCategory(isPreset ? initialData.category : "Otros");
        setCustomCategory(isPreset ? "" : initialData.category);
        setSuitcaseId(initialData.suitcase_id);
      } else {
        setName(""); setCategory("Otros"); setCustomCategory(""); setQuantity("1"); setSuitcaseId(null);
      }
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!name.trim()) { setError(t.nameRequired); return; }
    const finalCategory = category === "Otros" && customCategory.trim()
      ? customCategory.trim()
      : category;
    const data = {
      name: name.trim(),
      category: finalCategory,
      quantity: Math.max(1, parseInt(quantity) || 1),
      suitcase_id: suitcaseId,
    };
    if (initialData) {
      updatePackingItem(tripId, initialData.id, data);
    } else {
      createPackingItem(tripId, { ...data, packed: 0 });
    }
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {initialData ? t.editPackingItem : t.addPackingItem}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 px-5 py-4 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">{t.name} *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
              placeholder={t.packingItemPlaceholder} value={name}
              onChangeText={(v) => { setName(v); setError(""); }}
              autoFocus={!initialData}
            />
            {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t.category}</Text>
            <View className="flex-row flex-wrap gap-2">
              {PRESET_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full border ${category === c ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}
                >
                  <Text className={`text-sm font-medium ${category === c ? "text-white" : "text-gray-700"}`}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {category === "Otros" && (
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 mt-2"
                placeholder={t.customCategory}
                value={customCategory}
                onChangeText={setCustomCategory}
              />
            )}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">{t.quantity}</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => setQuantity(String(Math.max(1, (parseInt(quantity) || 1) - 1)))}
                className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="remove" size={20} color="#374151" />
              </TouchableOpacity>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 text-center w-16"
                value={quantity} onChangeText={setQuantity}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                onPress={() => setQuantity(String((parseInt(quantity) || 1) + 1))}
                className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="add" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t.suitcase}</Text>
            <View className="flex-row flex-wrap gap-2">
              {[{ id: null, name: t.noSuitcase }, ...suitcases].map((s) => (
                <TouchableOpacity
                  key={s.id ?? "none"}
                  onPress={() => setSuitcaseId(s.id)}
                  className={`px-3 py-1.5 rounded-full border ${suitcaseId === s.id ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}
                >
                  <Text className={`text-sm font-medium ${suitcaseId === s.id ? "text-white" : "text-gray-700"}`}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-indigo-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? t.saveChanges : t.addToPacking}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert(t.deletePackingItem, t.confirmDeletePackingItem(initialData.name), [
                { text: t.cancel, style: "cancel" },
                { text: t.delete, style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">{t.deletePackingItem}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
