import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createExpense, updateExpense, Expense } from "@/db/expenses";
import DatePickerInput from "@/components/DatePickerInput";

type ExpenseCategory = Expense["category"];
const CATEGORIES: ExpenseCategory[] = [
  "FLIGHT", "ACCOMMODATION", "FOOD", "TRANSPORT", "ACTIVITY", "SHOPPING", "OTHER",
];
const CAT_LABELS: Record<ExpenseCategory, string> = {
  FLIGHT: "Vuelo", ACCOMMODATION: "Alojam.", FOOD: "Comida",
  TRANSPORT: "Transporte", ACTIVITY: "Actividad", SHOPPING: "Compras", OTHER: "Otro",
};

interface Props {
  tripId: number;
  tripCurrency: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: Expense;
}

export default function ExpenseFormModal({ tripId, tripCurrency, visible, onClose, onSaved, onDelete, initialData }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [currency, setCurrency] = useState(tripCurrency);
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setDescription(initialData.description);
        setAmount(String(initialData.amount));
        setCategory(initialData.category);
        setCurrency(initialData.currency);
        setDate(initialData.date);
        setPaid(initialData.paid === 1);
      } else {
        setDescription(""); setAmount(""); setCategory("OTHER");
        setCurrency(tripCurrency); setDate(today); setPaid(false);
      }
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!description.trim()) { setError("La descripción es obligatoria"); return; }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El importe debe ser un número positivo");
      return;
    }
    const data = {
      description: description.trim(),
      amount: parsedAmount,
      category,
      currency: currency.trim().toUpperCase() || tripCurrency,
      date,
      paid: paid ? 1 : 0,
      notes: initialData?.notes ?? null,
    };
    if (initialData) {
      updateExpense(initialData.id, data);
    } else {
      createExpense(tripId, data);
    }
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {initialData ? "Editar gasto" : "Añadir gasto"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Descripción *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Cena en restaurante" value={description}
                onChangeText={(v) => { setDescription(v); setError(""); }}
                autoFocus={!initialData}
              />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Importe *</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="0.00" value={amount}
                  onChangeText={(v) => { setAmount(v); setError(""); }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="w-24">
                <Text className="text-sm font-medium text-gray-700 mb-1">Moneda</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="EUR" value={currency}
                  onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                  maxLength={3} autoCapitalize="characters"
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Categoría</Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full border ${category === c ? "bg-green-600 border-green-600" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${category === c ? "text-white" : "text-gray-700"}`}>
                      {CAT_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Fecha</Text>
              <DatePickerInput value={date} onChange={setDate} placeholder="Seleccionar fecha" />
            </View>

            <TouchableOpacity
              onPress={() => setPaid(!paid)}
              className="flex-row items-center gap-3"
            >
              <View className={`w-6 h-6 rounded border-2 items-center justify-center ${paid ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                {paid ? <Ionicons name="checkmark" size={14} color="white" /> : null}
              </View>
              <Text className="text-base text-gray-700">Ya pagado</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-green-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? "Guardar cambios" : "Guardar gasto"}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert("Eliminar gasto", `¿Eliminar "${initialData.description}"?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">Eliminar gasto</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
