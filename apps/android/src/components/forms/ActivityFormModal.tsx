import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createActivity, updateActivity, Activity } from "@/db/activities";
import DatePickerInput from "@/components/DatePickerInput";

type ActivityType = Activity["type"];
type ActivityStatus = Activity["status"];

const TYPES: ActivityType[] = ["ACTIVITY", "RESTAURANT", "MUSEUM", "TOUR", "TRANSPORT", "SHOW", "OTHER"];
const TYPE_LABELS: Record<ActivityType, string> = {
  ACTIVITY: "Actividad", RESTAURANT: "Restaurante", MUSEUM: "Museo",
  TOUR: "Tour", TRANSPORT: "Transporte", SHOW: "Espectáculo", OTHER: "Otro",
};
const STATUSES: ActivityStatus[] = ["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"];
const STATUS_LABELS: Record<ActivityStatus, string> = {
  PENDING: "Pendiente", RESERVED: "Reservado",
  CONFIRMED: "Confirmado", CANCELLED: "Cancelado",
};

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: Activity;
}

export default function ActivityFormModal({ tripId, visible, onClose, onSaved, onDelete, initialData }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ActivityType>("ACTIVITY");
  const [status, setStatus] = useState<ActivityStatus>("PENDING");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setType(initialData.type);
        setStatus(initialData.status);
        setLocation(initialData.location ?? "");
        setCity(initialData.city ?? "");
        setScheduledAt(initialData.scheduled_at ?? "");
        setPrice(initialData.price != null ? String(initialData.price) : "");
      } else {
        setName(""); setType("ACTIVITY"); setStatus("PENDING");
        setLocation(""); setCity(""); setScheduledAt(""); setPrice("");
      }
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    const data = {
      name: name.trim(),
      type,
      status,
      location: location.trim() || null,
      city: city.trim() || null,
      scheduled_at: scheduledAt || null,
      duration: null,
      booking_ref: null,
      confirmation_url: null,
      price: price ? parseFloat(price) : null,
      description: null,
      notes: null,
    };
    if (initialData) {
      updateActivity(initialData.id, data);
    } else {
      createActivity(tripId, data);
    }
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {initialData ? "Editar actividad" : "Añadir actividad"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Visita al Templo Senso-ji" value={name}
                onChangeText={(v) => { setName(v); setError(""); }}
                autoFocus={!initialData}
              />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full border ${type === t ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${type === t ? "text-white" : "text-gray-700"}`}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Estado</Text>
              <View className="flex-row flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-full border ${status === s ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${status === s ? "text-white" : "text-gray-700"}`}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Lugar</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="Asakusa" value={location} onChangeText={setLocation}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Ciudad</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="Tokio" value={city} onChangeText={setCity}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Fecha y hora</Text>
              <DatePickerInput value={scheduledAt} onChange={setScheduledAt} mode="datetime" placeholder="Seleccionar" />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Precio (€)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 w-36"
                placeholder="0.00" value={price} onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-orange-500 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? "Guardar cambios" : "Guardar actividad"}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert("Eliminar actividad", `¿Eliminar "${initialData.name}"?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">Eliminar actividad</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
