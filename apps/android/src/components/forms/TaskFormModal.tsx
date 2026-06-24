import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createTask, Task } from "@/db/tasks";

type TaskPriority = Task["priority"];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta",
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "bg-gray-500 border-gray-500",
  MEDIUM: "bg-yellow-500 border-yellow-500",
  HIGH: "bg-red-500 border-red-500",
};

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskFormModal({ tripId, visible, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [error, setError] = useState("");

  function reset() {
    setTitle(""); setNotes(""); setDueDate(""); setPriority("MEDIUM"); setError("");
  }

  function handleSave() {
    if (!title.trim()) { setError("El título es obligatorio"); return; }
    createTask(tripId, {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      priority,
      done: 0,
    });
    reset();
    onSaved();
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">Nueva tarea</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Título *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Reservar traslado al aeropuerto" value={title}
                onChangeText={(v) => { setTitle(v); setError(""); }}
                autoFocus
              />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Prioridad</Text>
              <View className="flex-row gap-2">
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    className={`px-4 py-1.5 rounded-full border ${priority === p ? PRIORITY_COLORS[p] : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${priority === p ? "text-white" : "text-gray-700"}`}>
                      {PRIORITY_LABELS[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Fecha límite</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="YYYY-MM-DD (opcional)" value={dueDate} onChangeText={setDueDate}
              />
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
          <TouchableOpacity onPress={handleSave} className="bg-violet-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">Crear tarea</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
