import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Tabs, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import {
  getDiveEquipment, deleteDiveEquipment, listEquipmentService, deleteEquipmentService,
  DiveEquipment, DiveEquipmentService,
} from "@/db/dive-equipment";
import { isServiceDue } from "@/lib/equipment-service";
import DiveEquipmentFormModal from "@/components/forms/DiveEquipmentFormModal";
import EquipmentServiceFormModal from "@/components/forms/EquipmentServiceFormModal";
import { useT } from "@/contexts/I18nContext";

const COLOR = "#0e7490";

function formatDate(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const equipmentId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [equipment, setEquipment] = useState<DiveEquipment | null>(null);
  const [service, setService] = useState<DiveEquipmentService[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);

  const refresh = useCallback(() => {
    setEquipment(getDiveEquipment(equipmentId));
    setService(listEquipmentService(equipmentId));
  }, [equipmentId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (!equipment) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
        <Tabs.Screen options={{ title: "" }} />
      </SafeAreaView>
    );
  }

  const serviceDue = isServiceDue(equipment);

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: equipment.name,
        headerRight: () => (
          <TouchableOpacity onPress={() => setEditOpen(true)}>
            <Ionicons name="pencil" size={20} color={isDark ? "#f1f5f9" : "#374151"} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-4">
          {(equipment.brand || equipment.model) && (
            <Text className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              {[equipment.brand, equipment.model].filter(Boolean).join(" ")}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-x-6 gap-y-2">
            {equipment.size && (
              <View><Text className="text-xs text-slate-400">{t.equipmentSize}</Text><Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{equipment.size}</Text></View>
            )}
            {equipment.serial_number && (
              <View><Text className="text-xs text-slate-400">{t.equipmentSerialNumber}</Text><Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{equipment.serial_number}</Text></View>
            )}
            {equipment.purchase_date && (
              <View><Text className="text-xs text-slate-400">{t.equipmentPurchaseDate}</Text><Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(equipment.purchase_date, lang)}</Text></View>
            )}
            {equipment.purchase_price != null && (
              <View><Text className="text-xs text-slate-400">{t.equipmentPurchasePrice}</Text><Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{equipment.purchase_price.toFixed(2)} €</Text></View>
            )}
            {equipment.last_service_date && (
              <View><Text className="text-xs text-slate-400">{t.equipmentLastServiceDate}</Text><Text className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(equipment.last_service_date, lang)}</Text></View>
            )}
          </View>
          {serviceDue && (
            <View className="flex-row items-center gap-1.5 mt-3 rounded-lg px-3 py-2 bg-amber-100 dark:bg-amber-900/30 self-start">
              <Ionicons name="warning-outline" size={14} color="#b45309" />
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t.equipmentServiceDue}</Text>
            </View>
          )}
          {equipment.notes && (
            <Text className="text-sm text-slate-600 dark:text-slate-300 mt-3">{equipment.notes}</Text>
          )}
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.equipmentServiceHistory}</Text>
          <TouchableOpacity onPress={() => setServiceFormOpen(true)} className="flex-row items-center gap-1">
            <Ionicons name="add-circle-outline" size={16} color={COLOR} />
            <Text className="text-sm font-medium" style={{ color: COLOR }}>{t.equipmentAddService}</Text>
          </TouchableOpacity>
        </View>

        {service.length === 0 ? (
          <Text className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">{t.noEquipmentService}</Text>
        ) : (
          service.map((s) => (
            <TouchableOpacity
              key={s.id}
              onLongPress={() => Alert.alert(s.description, undefined, [
                { text: t.delete, style: "destructive", onPress: () => { deleteEquipmentService(s.id); refresh(); } },
                { text: t.cancel, style: "cancel" },
              ])}
              className="bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 mb-2 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 mr-2">{s.description}</Text>
                {s.cost != null && <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">{s.cost.toFixed(2)} €</Text>}
              </View>
              <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatDate(s.date, lang)}</Text>
              {s.notes && <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.notes}</Text>}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <DiveEquipmentFormModal
        visible={editOpen}
        initialData={equipment}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); refresh(); }}
        onDelete={() => {
          deleteDiveEquipment(equipment.id);
          setEditOpen(false);
          router.back();
        }}
      />
      <EquipmentServiceFormModal
        visible={serviceFormOpen}
        equipmentId={equipment.id}
        onClose={() => setServiceFormOpen(false)}
        onSaved={() => { setServiceFormOpen(false); refresh(); }}
      />
    </SafeAreaView>
  );
}
