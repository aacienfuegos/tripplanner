import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createAccommodation, Accommodation } from "@/db/accommodations";
import DatePickerInput from "@/components/DatePickerInput";

type AccomType = Accommodation["type"];
const TYPES: AccomType[] = ["HOTEL", "HOSTEL", "AIRBNB", "APARTMENT", "RESORT", "OTHER"];
const TYPE_LABELS: Record<AccomType, string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", AIRBNB: "Airbnb",
  APARTMENT: "Apartamento", RESORT: "Resort", OTHER: "Otro",
};

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccommodationFormModal({ tripId, visible, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<AccomType>("HOTEL");
  const [address, setAddress] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setName(""); setCity(""); setType("HOTEL"); setAddress("");
    setCheckIn(""); setCheckOut(""); setBookingRef(""); setPricePerNight(""); setError("");
  }

  function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!city.trim()) { setError("La ciudad es obligatoria"); return; }
    createAccommodation(tripId, {
      name: name.trim(),
      city: city.trim(),
      type,
      address: address.trim() || null,
      check_in: checkIn || null,
      check_out: checkOut || null,
      booking_ref: bookingRef.trim() || null,
      confirmation_url: null,
      price: null,
      price_per_night: pricePerNight ? parseFloat(pricePerNight) : null,
      notes: null,
    });
    reset();
    onSaved();
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">Añadir alojamiento</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Hotel Okura" value={name}
                onChangeText={(v) => { setName(v); setError(""); }}
                autoFocus
              />
              {error && name.trim() === "" ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Ciudad *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Tokio" value={city}
                onChangeText={(v) => { setCity(v); setError(""); }}
              />
              {error && city.trim() === "" ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full border ${type === t ? "bg-purple-600 border-purple-600" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${type === t ? "text-white" : "text-gray-700"}`}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Dirección</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                placeholder="Opcional" value={address} onChangeText={setAddress}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Check-in</Text>
                <DatePickerInput value={checkIn} onChange={setCheckIn} placeholder="Seleccionar" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Check-out</Text>
                <DatePickerInput value={checkOut} onChange={setCheckOut} placeholder="Seleccionar" />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Ref. reserva</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="ABC123" value={bookingRef}
                  onChangeText={(v) => setBookingRef(v.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Precio/noche (€)</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="0.00" value={pricePerNight} onChangeText={setPricePerNight}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100">
          <TouchableOpacity onPress={handleSave} className="bg-purple-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">Guardar alojamiento</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
