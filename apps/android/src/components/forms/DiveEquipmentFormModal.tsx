import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import {
  createDiveEquipment, updateDiveEquipment, DiveEquipment, EquipmentCategory, EquipmentStatus,
} from "@/db/dive-equipment";
import DatePickerInput from "@/components/DatePickerInput";
import { useT } from "@/contexts/I18nContext";

const CATEGORIES: EquipmentCategory[] = [
  "WETSUIT", "BCD", "REGULATOR", "COMPUTER", "FINS", "MASK", "TANK", "WEIGHT", "TORCH", "CAMERA", "OTHER",
];
const STATUSES: EquipmentStatus[] = ["OWNED", "WISHLIST", "RETIRED", "SOLD"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: DiveEquipment;
}

export default function DiveEquipmentFormModal({ visible, onClose, onSaved, onDelete, initialData }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("OTHER");
  const [status, setStatus] = useState<EquipmentStatus>("OWNED");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [size, setSize] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [serviceIntervalMonths, setServiceIntervalMonths] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const categoryLabels: Record<EquipmentCategory, string> = {
    WETSUIT: t.equipmentCategoryWetsuit, BCD: t.equipmentCategoryBcd, REGULATOR: t.equipmentCategoryRegulator,
    COMPUTER: t.equipmentCategoryComputer, FINS: t.equipmentCategoryFins, MASK: t.equipmentCategoryMask,
    TANK: t.equipmentCategoryTank, WEIGHT: t.equipmentCategoryWeight, TORCH: t.equipmentCategoryTorch,
    CAMERA: t.equipmentCategoryCamera, OTHER: t.equipmentCategoryOther,
  };
  const statusLabels: Record<EquipmentStatus, string> = {
    OWNED: t.equipmentStatusOwned, WISHLIST: t.equipmentStatusWishlist,
    RETIRED: t.equipmentStatusRetired, SOLD: t.equipmentStatusSold,
  };

  useEffect(() => {
    if (visible) {
      setName(initialData?.name ?? "");
      setCategory(initialData?.category ?? "OTHER");
      setStatus(initialData?.status ?? "OWNED");
      setBrand(initialData?.brand ?? "");
      setModel(initialData?.model ?? "");
      setSize(initialData?.size ?? "");
      setSerialNumber(initialData?.serial_number ?? "");
      setPurchaseDate(initialData?.purchase_date ?? "");
      setPurchasePrice(initialData?.purchase_price != null ? String(initialData.purchase_price) : "");
      setLastServiceDate(initialData?.last_service_date ?? "");
      setServiceIntervalMonths(initialData?.service_interval_months != null ? String(initialData.service_interval_months) : "");
      setNotes(initialData?.notes ?? "");
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!name.trim()) { setError(t.equipmentName); return; }
    const data = {
      name: name.trim(), category, status,
      brand: brand.trim() || null, model: model.trim() || null, size: size.trim() || null,
      serial_number: serialNumber.trim() || null,
      purchase_date: purchaseDate || null,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
      last_service_date: lastServiceDate || null,
      service_interval_months: serviceIntervalMonths ? parseInt(serviceIntervalMonths, 10) : null,
      notes: notes.trim() || null,
    };
    if (initialData) updateDiveEquipment(initialData.id, data);
    else createDiveEquipment(data);
    onSaved();
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";
  const label = "text-sm font-medium text-gray-700 dark:text-slate-300 mb-1";

  function ChipRow<T extends string>({ options, value, onChange, labels }: {
    options: T[]; value: T; onChange: (v: T) => void; labels: Record<T, string>;
  }) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-full border ${value === opt ? "bg-cyan-700 border-cyan-700" : "border-gray-300 dark:border-zinc-700"}`}
            >
              <Text className={value === opt ? "text-white text-sm font-medium" : "text-gray-700 dark:text-slate-300 text-sm font-medium"}>
                {labels[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editEquipment : t.addEquipment}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className={label}>{t.equipmentName} *</Text>
              <TextInput className={inputClass} value={name} onChangeText={(v) => { setName(v); setError(""); }} autoFocus />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>
            <View>
              <Text className={label}>{t.equipmentCategory}</Text>
              <ChipRow options={CATEGORIES} value={category} onChange={setCategory} labels={categoryLabels} />
            </View>
            <View>
              <Text className={label}>{t.equipmentStatus}</Text>
              <ChipRow options={STATUSES} value={status} onChange={setStatus} labels={statusLabels} />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.equipmentBrand}</Text>
                <TextInput className={inputClass} value={brand} onChangeText={setBrand} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.equipmentModel}</Text>
                <TextInput className={inputClass} value={model} onChangeText={setModel} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.equipmentSize}</Text>
                <TextInput className={inputClass} value={size} onChangeText={setSize} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.equipmentSerialNumber}</Text>
                <TextInput className={inputClass} value={serialNumber} onChangeText={setSerialNumber} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.equipmentPurchaseDate}</Text>
                <DatePickerInput value={purchaseDate} onChange={setPurchaseDate} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.equipmentPurchasePrice}</Text>
                <TextInput className={inputClass} value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.equipmentLastServiceDate}</Text>
                <DatePickerInput value={lastServiceDate} onChange={setLastServiceDate} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.equipmentServiceInterval}</Text>
                <TextInput className={inputClass} value={serviceIntervalMonths} onChangeText={setServiceIntervalMonths} keyboardType="number-pad" />
              </View>
            </View>
            <View>
              <Text className={label}>{t.notes}</Text>
              <TextInput className={inputClass} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
            </View>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-zinc-800 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-cyan-700 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.save}</Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert(t.editEquipment, t.confirmDeleteEquipment, [
                { text: t.cancel, style: "cancel" },
                { text: t.delete, style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">{t.delete}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
