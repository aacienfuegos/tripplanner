import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createPackingItem, updatePackingItem, PackingItem } from "@/db/packing";

const PRESET_CATEGORIES = ["Ropa", "Higiene", "Electrónica", "Documentos", "Medicación", "Otros"];

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: PackingItem;
}

export default function PackingFormModal({ tripId, visible, onClose, onSaved, onDelete, initialData }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Otros");
  const [customCategory, setCustomCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setQuantity(String(initialData.quantity));
        const isPreset = PRESET_CATEGORIES.includes(initialData.category);
        setCategory(isPreset ? initialData.category : "Otros");
        setCustomCategory(isPreset ? "" : initialData.category);
      } else {
        setName(""); setCategory("Otros"); setCustomCategory(""); setQuantity("1");
      }
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    const finalCategory = category === "Otros" && customCategory.trim()
      ? customCategory.trim()
      : category;
    const data = {
      name: name.trim(),
      category: finalCategory,
      quantity: Math.max(1, parseInt(quantity) || 1),
    };
    if (initialData) {
      updatePackingItem(initialData.id, data);
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
            {initialData ? "Editar ítem" : "Añadir ítem"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 px-5 py-4 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
              placeholder="Cargador del móvil" value={name}
              onChangeText={(v) => { setName(v); setError(""); }}
              autoFocus={!initialData}
            />
            {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Categoría</Text>
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
                placeholder="Categoría personalizada"
                value={customCategory}
                onChangeText={setCustomCategory}
              />
            )}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Cantidad</Text>
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
        </View>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-indigo-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? "Guardar cambios" : "Añadir a la maleta"}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert("Eliminar ítem", `¿Eliminar "${initialData.name}"?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">Eliminar ítem</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
