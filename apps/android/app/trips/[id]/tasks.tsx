import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTasks, deleteTask, toggleTaskDone, Task } from "@/db/tasks";
import TaskFormModal from "@/components/forms/TaskFormModal";

const PRIORITY_BG: Record<Task["priority"], string> = {
  LOW: "bg-gray-100", MEDIUM: "bg-yellow-100", HIGH: "bg-red-100",
};
const PRIORITY_TEXT: Record<Task["priority"], string> = {
  LOW: "text-gray-600", MEDIUM: "text-yellow-700", HIGH: "text-red-700",
};
const PRIORITY_LABELS: Record<Task["priority"], string> = {
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta",
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function TasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(useCallback(() => { setTasks(listTasks(tripId)); }, [tripId]));

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const doneCount = done.length;

  function handleDelete(taskId: number, title: string) {
    Alert.alert("Eliminar tarea", `¿Eliminar "${title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: () => { deleteTask(taskId); setTasks(listTasks(tripId)); },
      },
    ]);
  }

  function renderTask({ item }: { item: Task }) {
    const overdue = !item.done && isOverdue(item.due_date);
    return (
      <TouchableOpacity
        onPress={() => { toggleTaskDone(item.id, !item.done); setTasks(listTasks(tripId)); }}
        onLongPress={() => handleDelete(item.id, item.title)}
        className="bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100 shadow-sm flex-row items-start gap-3"
      >
        <View className={`mt-0.5 w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0 ${item.done ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
          {item.done ? <Ionicons name="checkmark" size={12} color="white" /> : null}
        </View>
        <View className="flex-1">
          <Text className={`text-base font-medium ${item.done ? "line-through text-gray-400" : "text-gray-900"}`}>
            {item.title}
          </Text>
          {item.notes ? (
            <Text className="text-xs text-gray-400 mt-0.5">{item.notes}</Text>
          ) : null}
          <View className="flex-row items-center gap-2 mt-1.5">
            <View className={`px-2 py-0.5 rounded ${PRIORITY_BG[item.priority as Task["priority"]]}`}>
              <Text className={`text-xs font-medium ${PRIORITY_TEXT[item.priority as Task["priority"]]}`}>
                {PRIORITY_LABELS[item.priority as Task["priority"]]}
              </Text>
            </View>
            {item.due_date && (
              <Text className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                {overdue ? "Vencida · " : ""}{item.due_date.slice(0, 10)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      {tasks.length > 0 && doneCount > 0 && (
        <View className="mx-4 mt-4 p-3 bg-violet-50 border border-violet-100 rounded-xl">
          <Text className="text-center text-sm text-violet-800">
            {doneCount} / {tasks.length} tareas completadas
          </Text>
        </View>
      )}
      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(t) => String(t.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="checkmark-circle-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin tareas añadidas</Text>
            <Text className="mt-1 text-xs text-gray-400">
              Pulsa "+" para añadir una tarea
            </Text>
          </View>
        }
        renderItem={renderTask}
      />
      <TouchableOpacity
        onPress={() => setFormOpen(true)}
        className="mx-4 mb-4 bg-violet-600 rounded-xl py-3 flex-row items-center justify-center gap-2"
      >
        <Ionicons name="add-circle-outline" size={18} color="white" />
        <Text className="text-white font-semibold">Nueva tarea</Text>
      </TouchableOpacity>
      <TaskFormModal
        tripId={tripId} visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setTasks(listTasks(tripId)); }}
      />
    </SafeAreaView>
  );
}
