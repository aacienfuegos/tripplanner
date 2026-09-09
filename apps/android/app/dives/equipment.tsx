import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDiveEquipment, deleteDiveEquipment, countDiveLogsUsingEquipment, DiveEquipment } from "@/db/dive-equipment";
import { isServiceDue } from "@/lib/equipment-service";
import DiveEquipmentFormModal from "@/components/forms/DiveEquipmentFormModal";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

export default function DiveEquipmentScreen() {
  const router = useRouter();
  const { t } = useT();
  const [items, setItems] = useState<DiveEquipment[]>([]);
  const [tab, setTab] = useState<"gear" | "wishlist">("gear");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiveEquipment | undefined>();

  const refresh = useCallback(() => setItems(listDiveEquipment()), []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const categoryLabels: Record<DiveEquipment["category"], string> = {
    WETSUIT: t.equipmentCategoryWetsuit, BCD: t.equipmentCategoryBcd, REGULATOR: t.equipmentCategoryRegulator,
    COMPUTER: t.equipmentCategoryComputer, FINS: t.equipmentCategoryFins, MASK: t.equipmentCategoryMask,
    TANK: t.equipmentCategoryTank, WEIGHT: t.equipmentCategoryWeight, TORCH: t.equipmentCategoryTorch,
    CAMERA: t.equipmentCategoryCamera, OTHER: t.equipmentCategoryOther,
  };

  const gear = useMemo(() => items.filter((e) => e.status !== "WISHLIST"), [items]);
  const wishlist = useMemo(() => items.filter((e) => e.status === "WISHLIST"), [items]);
  const shown = tab === "gear" ? gear : wishlist;

  function openEdit(item: DiveEquipment) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{ title: t.diveEquipmentTab }} />

      <View className="flex-row px-4 pt-3 gap-2">
        {(["gear", "wishlist"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            className={`flex-1 py-2 rounded-full items-center ${tab === key ? "bg-cyan-700" : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"}`}
          >
            <Text className={`text-sm font-semibold ${tab === key ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {key === "gear" ? t.equipmentMyGearTab : t.equipmentWishlistTab} ({key === "gear" ? gear.length : wishlist.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="briefcase-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noEquipment}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noEquipmentHint}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const usedCount = countDiveLogsUsingEquipment(item.id);
          const serviceDue = isServiceDue(item);
          return (
            <TouchableOpacity
              onPress={() => router.push(`/dives/equipment-detail?id=${item.id}`)}
              onLongPress={() => Alert.alert(item.name, undefined, [
                { text: t.edit, onPress: () => openEdit(item) },
                { text: t.delete, style: "destructive", onPress: () => { deleteDiveEquipment(item.id); refresh(); } },
                { text: t.cancel, style: "cancel" },
              ])}
              className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
              style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
              activeOpacity={0.75}
            >
              <View className="px-4 py-3.5">
                <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{item.name}</Text>
                <View className="flex-row items-center gap-1.5 flex-wrap mt-1.5">
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                    <Text className="text-xs font-semibold" style={{ color: COLOR }}>{categoryLabels[item.category]}</Text>
                  </View>
                  {usedCount > 0 && (
                    <Text className="text-xs text-slate-400 dark:text-slate-500">{t.equipmentUsedInDives(usedCount)}</Text>
                  )}
                  {serviceDue && (
                    <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30">
                      <Ionicons name="warning-outline" size={11} color="#b45309" />
                      <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t.equipmentServiceDue}</Text>
                    </View>
                  )}
                </View>
                {(item.brand || item.model) && (
                  <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    {[item.brand, item.model].filter(Boolean).join(" ")}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <DiveEquipmentFormModal
        visible={formOpen}
        initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDiveEquipment(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
