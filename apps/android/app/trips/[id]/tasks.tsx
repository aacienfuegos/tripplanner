import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTasks, deleteTask, toggleTaskDone, Task } from "@/db/tasks";
import TaskFormModal from "@/components/forms/TaskFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import ImportWizard from "@/components/import/ImportWizard";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#7c3aed";
const COLOR_BG = "#7c3aed18";

const PRIORITY_STYLES: Record<Task["priority"], { bg: string; text: string }> = {
  LOW:    { bg: "#f1f5f9", text: "#64748b" },
  MEDIUM: { bg: "#fef9c3", text: "#854d0e" },
  HIGH:   { bg: "#fee2e2", text: "#991b1b" },
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function TasksScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t } = useT();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  useFocusEffect(useCallback(() => { setTasks(listTasks(tripId)); }, [tripId]));

  function refresh() { setTasks(listTasks(tripId)); }
  function openAdd() { setEditingTask(undefined); setFormOpen(true); }

  function handleLongPress(task: Task) {
    Alert.alert(task.title, undefined, [
      { text: t.edit, onPress: () => { setEditingTask(task); setFormOpen(true); } },
      { text: t.delete, style: "destructive", onPress: () => { deleteTask(task.id); refresh(); } },
      { text: t.cancel, style: "cancel" },
    ]);
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const priorityLabels: Record<Task["priority"], string> = {
    LOW: t.priorityLow, MEDIUM: t.priorityMedium, HIGH: t.priorityHigh,
  };

  function renderTask({ item }: { item: Task }) {
    const overdue = !item.done && isOverdue(item.due_date);
    const pStyle = PRIORITY_STYLES[item.priority as Task["priority"]];
    return (
      <TouchableOpacity
        onPress={() => { setEditingTask(item); setFormOpen(true); }}
        onLongPress={() => handleLongPress(item)}
        className="bg-white dark:bg-zinc-900 rounded-2xl mb-2 overflow-hidden shadow-sm"
        style={{ borderLeftWidth: 3, borderLeftColor: item.done ? "#d1fae5" : COLOR }}
        activeOpacity={0.75}
      >
        <View className="px-4 py-3.5 flex-row items-start gap-3">
          <TouchableOpacity
            onPress={() => { toggleTaskDone(item.id, !item.done); refresh(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className={`mt-0.5 w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-zinc-600"}`}
          >
            {item.done ? <Ionicons name="checkmark" size={11} color="white" /> : null}
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`text-base font-semibold ${item.done ? "line-through text-slate-400 dark:text-zinc-600" : "text-slate-900 dark:text-white"}`}>
              {item.title}
            </Text>
            {item.notes ? (
              <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" numberOfLines={1}>{item.notes}</Text>
            ) : null}
            <View className="flex-row items-center gap-2 mt-1.5">
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: pStyle.bg }}>
                <Text className="text-xs font-medium" style={{ color: pStyle.text }}>
                  {priorityLabels[item.priority as Task["priority"]]}
                </Text>
              </View>
              {item.due_date && (
                <Text className={`text-xs font-medium ${overdue ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
                  {overdue ? `${t.overdue} · ` : ""}{item.due_date.slice(0, 10)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.tasks,
        headerRight: () => <SectionHeaderRight tripId={id!} onImportPress={() => setImportOpen(true)} />,
      }} />

      {tasks.length > 0 && done.length > 0 && (
        <View className="mx-4 mt-3 bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm" style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}>
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.taskProgress}</Text>
            <Text className="text-sm font-bold" style={{ color: done.length === tasks.length ? "#059669" : COLOR }}>
              {done.length}/{tasks.length}
            </Text>
          </View>
          <View className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round((done.length / tasks.length) * 100)}%`,
                backgroundColor: done.length === tasks.length ? "#059669" : COLOR,
              }}
            />
          </View>
        </View>
      )}

      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noTasks}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noTasksHint}</Text>
          </View>
        }
        renderItem={renderTask}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <TaskFormModal
        tripId={tripId} visible={formOpen} initialData={editingTask}
        onClose={() => { setFormOpen(false); setEditingTask(undefined); }}
        onSaved={() => { setFormOpen(false); setEditingTask(undefined); refresh(); }}
        onDelete={editingTask ? () => { deleteTask(editingTask.id); setFormOpen(false); setEditingTask(undefined); refresh(); } : undefined}
      />
      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); refresh(); }}
      />
    </SafeAreaView>
  );
}
