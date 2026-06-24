import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createTask, updateTask, Task } from "@/db/tasks";
import DatePickerInput from "@/components/DatePickerInput";

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
  onDelete?: () => void;
  initialData?: Task;
}

export default function TaskFormModal({ tripId, visible, onClose, onSaved, onDelete, initialData }: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setTitle(initialData.title);
        setNotes(initialData.notes ?? "");
        setDueDate(initialData.due_date ?? "");
        setPriority(initialData.priority);
      } else {
        setTitle(""); setNotes(""); setDueDate(""); setPriority("MEDIUM");
      }
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!title.trim()) { setError("El título es obligatorio"); return; }
    const data = {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      priority,
      done: initialData?.done ?? 0,
    };
    if (initialData) {
      updateTask(initialData.id, data);
    } else {
      createTask(tripId, data);
    }
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {initialData ? "Editar tarea" : "Nueva tarea"}
          </Text>
          <TouchableOpacity onPress={onClose}>
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
                autoFocus={!initialData}
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
              <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Sin fecha límite" />
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
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-violet-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? "Guardar cambios" : "Crear tarea"}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert("Eliminar tarea", `¿Eliminar "${initialData.title}"?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">Eliminar tarea</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
