import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDiveCertifications, deleteDiveCertification, DiveCertification } from "@/db/dive-certifications";
import DiveCertificationFormModal from "@/components/forms/DiveCertificationFormModal";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

function formatDate(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function DiveCertificationsScreen() {
  const { t, lang } = useT();
  const [items, setItems] = useState<DiveCertification[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiveCertification | undefined>();

  const refresh = useCallback(() => setItems(listDiveCertifications()), []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function openEdit(item: DiveCertification) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{ title: t.diveCertificationsTab }} />

      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="ribbon-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noCertifications}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noCertificationsHint}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => Alert.alert(item.level, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.delete, style: "destructive", onPress: () => { deleteDiveCertification(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ])}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5">
              <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{item.level}</Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{item.agency}</Text>
              {item.issue_date && (
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{formatDate(item.issue_date, lang)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <DiveCertificationFormModal
        visible={formOpen}
        initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDiveCertification(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
