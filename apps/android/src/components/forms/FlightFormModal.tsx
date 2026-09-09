import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createFlight, updateFlight, Flight } from "@/db/flights";
import DatePickerInput from "@/components/DatePickerInput";
import { geocodeAirportText } from "@/lib/geocode";

type FlightClass = Flight["class"];
const CLASSES: FlightClass[] = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"];
const CLASS_LABELS: Record<FlightClass, string> = {
  ECONOMY: "Economy", PREMIUM_ECONOMY: "Prem. Eco",
  BUSINESS: "Business", FIRST: "Primera",
};

interface Props {
  tripId: number;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: Flight;
}

export default function FlightFormModal({ tripId, visible, onClose, onSaved, onDelete, initialData }: Props) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [flightClass, setFlightClass] = useState<FlightClass>("ECONOMY");
  const [bookingRef, setBookingRef] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setOrigin(initialData.origin);
        setDestination(initialData.destination);
        setAirline(initialData.airline ?? "");
        setFlightNumber(initialData.flight_number ?? "");
        setDepartureAt(initialData.departure_at ?? "");
        setArrivalAt(initialData.arrival_at ?? "");
        setFlightClass(initialData.class);
        setBookingRef(initialData.booking_ref ?? "");
        setSeatNumber(initialData.seat_number ?? "");
        setPrice(initialData.price != null ? String(initialData.price) : "");
      } else {
        setOrigin(""); setDestination(""); setAirline(""); setFlightNumber("");
        setDepartureAt(""); setArrivalAt(""); setFlightClass("ECONOMY");
        setBookingRef(""); setSeatNumber(""); setPrice("");
      }
      setError("");
    }
  }, [visible, initialData]);

  async function handleSave() {
    if (!origin.trim()) { setError("El origen es obligatorio"); return; }
    if (!destination.trim()) { setError("El destino es obligatorio"); return; }

    let originLat = initialData?.origin_lat ?? null;
    let originLng = initialData?.origin_lng ?? null;
    if (originLat === null || originLng === null) {
      const geocoded = await geocodeAirportText(origin.trim());
      if (geocoded) { originLat = geocoded.latitude; originLng = geocoded.longitude; }
    }
    let destinationLat = initialData?.destination_lat ?? null;
    let destinationLng = initialData?.destination_lng ?? null;
    if (destinationLat === null || destinationLng === null) {
      const geocoded = await geocodeAirportText(destination.trim());
      if (geocoded) { destinationLat = geocoded.latitude; destinationLng = geocoded.longitude; }
    }

    const data = {
      origin: origin.trim(),
      destination: destination.trim(),
      airline: airline.trim() || null,
      flight_number: flightNumber.trim() || null,
      departure_at: departureAt || null,
      arrival_at: arrivalAt || null,
      class: flightClass,
      booking_ref: bookingRef.trim() || null,
      confirmation_url: null,
      seat_number: seatNumber.trim() || null,
      price: price ? parseFloat(price) : null,
      origin_lat: originLat,
      origin_lng: originLng,
      destination_lat: destinationLat,
      destination_lng: destinationLng,
      notes: null,
    };
    if (initialData) {
      await updateFlight(initialData.id, data);
    } else {
      await createFlight(tripId, data);
    }
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {initialData ? "Editar vuelo" : "Añadir vuelo"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Origen *</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="MAD" value={origin}
                  onChangeText={(v) => { setOrigin(v); setError(""); }}
                  autoCapitalize="characters"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Destino *</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="NRT" value={destination}
                  onChangeText={(v) => { setDestination(v); setError(""); }}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            {error ? <Text className="text-xs text-red-500 -mt-2">{error}</Text> : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Aerolínea</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="Iberia" value={airline} onChangeText={setAirline}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">Nº vuelo</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="IB6801" value={flightNumber}
                  onChangeText={(v) => setFlightNumber(v.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Salida</Text>
              <DatePickerInput value={departureAt} onChange={setDepartureAt} mode="datetime" placeholder="Seleccionar fecha y hora" />
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Llegada</Text>
              <DatePickerInput value={arrivalAt} onChange={setArrivalAt} mode="datetime" placeholder="Seleccionar fecha y hora" />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Clase</Text>
              <View className="flex-row flex-wrap gap-2">
                {CLASSES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFlightClass(c)}
                    className={`px-3 py-1.5 rounded-full border ${flightClass === c ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${flightClass === c ? "text-white" : "text-gray-700"}`}>
                      {CLASS_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                <Text className="text-sm font-medium text-gray-700 mb-1">Asiento</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
                  placeholder="23A" value={seatNumber}
                  onChangeText={(v) => setSeatNumber(v.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
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
          <TouchableOpacity onPress={handleSave} className="bg-blue-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">
              {initialData ? "Guardar cambios" : "Guardar vuelo"}
            </Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert("Eliminar vuelo", "¿Eliminar este vuelo?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">Eliminar vuelo</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
