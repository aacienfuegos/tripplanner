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

const CAT_ICONS: Record<Expense["category"], string> = {
  FLIGHT: "airplane-outline", ACCOMMODATION: "bed-outline",
  FOOD: "restaurant-outline", TRANSPORT: "car-outline",
  ACTIVITY: "walk-outline", SHOPPING: "bag-outline", OTHER: "ellipsis-horizontal-outline",
};

export default function ExpensesScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
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

  const total = sumExpenses(tripId, currency);

  function handleLongPress(item: Expense) {
    Alert.alert(item.description, undefined, [
      { text: "Editar", onPress: () => { setEditingItem(item); setFormOpen(true); } },
      { text: "Eliminar", style: "destructive", onPress: () => {
        deleteExpense(item.id); setItems(listExpenses(tripId));
      }},
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { setItems(listExpenses(tripId)); }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <Tabs.Screen options={{
        headerRight: () => (
          <SectionHeaderRight tripId={id} onImportPress={() => setImportOpen(true)} />
        ),
      }} />
      {items.length > 0 && (
        <View className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <Text className="text-center text-sm text-blue-800">
            Total {currency}: <Text className="font-bold">{total.toFixed(2)}</Text>
          </Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="cash-outline" size={40} color="#9ca3af" />
            <Text className="mt-3 text-gray-400">Sin gastos registrados</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => { toggleExpensePaid(item.id, !item.paid); refresh(); }}
            onLongPress={() => handleLongPress(item)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm flex-row items-center gap-3"
          >
            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
              <Ionicons name={CAT_ICONS[item.category as Expense["category"]] as any} size={20} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-gray-900">{item.description}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{item.date.slice(0, 10)}</Text>
            </View>
            <View className="items-end">
              <Text className="font-semibold text-gray-900">
                {item.amount.toFixed(2)} {item.currency}
              </Text>
              <Text className={`text-xs mt-0.5 ${item.paid ? "text-green-600" : "text-gray-400"}`}>
                {item.paid ? "Pagado" : "Pendiente"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View className="mx-4 mb-4">
        <TouchableOpacity
          onPress={openAdd}
          className="bg-green-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-semibold text-base">Añadir gasto</Text>
        </TouchableOpacity>
      </View>

      <ImportWizard
        tripId={tripId} visible={importOpen}
        onClose={() => { setImportOpen(false); refresh(); }}
      />
      <ExpenseFormModal
        tripId={tripId} tripCurrency={currency} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteExpense(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
