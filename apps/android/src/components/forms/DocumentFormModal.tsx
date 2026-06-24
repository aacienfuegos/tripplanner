import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createDocument, Document } from "@/db/documents";
import DatePickerInput from "@/components/DatePickerInput";

type DocType = Document["type"];
const TYPES: DocType[] = ["PASSPORT", "VISA", "INSURANCE", "TICKET", "VOUCHER", "OTHER"];
const TYPE_LABELS: Record<DocType, string> = {
  PASSPORT: "Pasaporte", VISA: "Visa", INSURANCE: "Seguro",
  TICKET: "Billete", VOUCHER: "Voucher", OTHER: "Otro",
};

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function DocumentFormModal({ tripId, visible, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DocType>("OTHER");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setName(""); setType("OTHER"); setExpiresAt(""); setNotes(""); setError("");
  }

  function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    createDocument(tripId, {
      name: name.trim(),
      type,
      expires_at: expiresAt || null,
      notes: notes.trim() || null,
    });
    reset();
    onSaved();
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">Añadir documento</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Pasaporte español" value={name}
                onChangeText={(v) => { setName(v); setError(""); }}
                autoFocus
              />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full border ${type === t ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${type === t ? "text-white" : "text-gray-700"}`}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Caduca</Text>
              <DatePickerInput value={expiresAt} onChange={setExpiresAt} placeholder="Sin caducidad" />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Notas</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Opcional" value={notes} onChangeText={setNotes}
                multiline numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100">
          <TouchableOpacity onPress={handleSave} className="bg-blue-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">Guardar documento</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
