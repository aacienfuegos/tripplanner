import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listExpenses, deleteExpense, toggleExpensePaid, sumExpenses, Expense } from "@/db/expenses";
import { getTrip } from "@/db/trips";
import ImportWizard from "@/components/import/ImportWizard";
import ExpenseFormModal from "@/components/forms/ExpenseFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#059669";
const COLOR_BG = "#05966918";

const CAT_ICONS: Record<Expense["category"], string> = {
  FLIGHT: "airplane-outline", ACCOMMODATION: "bed-outline",
  FOOD: "restaurant-outline", TRANSPORT: "car-outline",
  ACTIVITY: "walk-outline", SHOPPING: "bag-outline", OTHER: "ellipsis-horizontal-outline",
};

export default function ExpensesScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t } = useT();
  const [items, setItems] = useState<Expense[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | undefined>();
  const [currency, setCurrency] = useState("EUR");

  useFocusEffect(useCallback(() => {
    setItems(listExpenses(tripId));
    const trip = getTrip(tripId);
    if (trip) setCurrency(trip.currency);
  }, [tripId]));

  function refresh() { setItems(listExpenses(tripId)); }
  function openEdit(e: Expense) { setEditingItem(e); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }

  const total = sumExpenses(tripId, currency);
  const paid = items.filter((e) => e.paid === 1 && e.currency === currency).reduce((s, e) => s + e.amount, 0);
  const pending = total - paid;

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.expenses,
        headerRight: () => <SectionHeaderRight tripId={id!} onImportPress={() => setImportOpen(true)} />,
      }} />

      {items.length > 0 && (
        <View className="mx-4 mt-3 bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm" style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}>
          <Text className="text-xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium uppercase tracking-wider">{t.totalExpenses(currency)}</Text>
          <Text className="text-2xl font-black text-slate-900 dark:text-white">{total.toFixed(2)} <Text className="text-base font-semibold text-slate-400 dark:text-slate-500">{currency}</Text></Text>
          <View className="flex-row gap-4 mt-2 pt-2 border-t border-slate-50 dark:border-zinc-800">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-xs text-slate-500 dark:text-slate-400">{t.paid} <Text className="font-semibold text-slate-700 dark:text-slate-200">{paid.toFixed(2)}</Text></Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
              <Text className="text-xs text-slate-500 dark:text-slate-400">{t.pending} <Text className="font-semibold text-slate-700 dark:text-slate-200">{pending.toFixed(2)}</Text></Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="cash-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noExpenses}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noExpensesHint}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => Alert.alert(item.description, undefined, [
              { text: t.edit, onPress: () => openEdit(item) },
              { text: t.delete, style: "destructive", onPress: () => { deleteExpense(item.id); refresh(); } },
              { text: t.cancel, style: "cancel" },
            ])}
            className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
            style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}
            activeOpacity={0.75}
          >
            <View className="px-4 py-3.5 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0" style={{ backgroundColor: COLOR_BG }}>
                <Ionicons name={CAT_ICONS[item.category as Expense["category"]] as any} size={20} color={COLOR} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900 dark:text-white" numberOfLines={1}>{item.description}</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.date.slice(0, 10)}</Text>
              </View>
              <View className="items-end gap-1.5">
                <Text className="text-base font-bold text-slate-900 dark:text-white">
                  {item.amount.toFixed(2)} <Text className="text-xs font-normal text-slate-400 dark:text-slate-500">{item.currency}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => { toggleExpensePaid(item.id, !item.paid); refresh(); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="flex-row items-center gap-1"
                >
                  <View className={`w-4 h-4 rounded border items-center justify-center ${item.paid ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"}`}>
                    {item.paid ? <Ionicons name="checkmark" size={10} color="white" /> : null}
                  </View>
                  <Text className={`text-xs ${item.paid ? "text-emerald-600 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
                    {item.paid ? t.paid : t.pending}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <SectionFAB onPress={openAdd} color={COLOR} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <ExpenseFormModal
        tripId={tripId} tripCurrency={currency} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteExpense(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
