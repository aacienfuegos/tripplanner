import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTrip, updateTrip } from "@/db/trips";
import DatePickerInput from "@/components/DatePickerInput";
import { useT } from "@/contexts/I18nContext";

export default function EditTripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t } = useT();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");

  useEffect(() => {
    const trip = getTrip(tripId);
    if (trip) {
      setName(trip.name);
      setDescription(trip.description ?? "");
      setStartDate(trip.start_date ?? "");
      setEndDate(trip.end_date ?? "");
      setCurrency(trip.currency);
    }
  }, [tripId]);

  function handleSave() {
    if (!name.trim()) {
      setError(t.tripNameRequired);
      return;
    }
    updateTrip(tripId, {
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      currency,
    });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-900" edges={["bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-6 gap-5">
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.tripName} *</Text>
              <TextInput
                className="border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white bg-white dark:bg-zinc-800"
                placeholder={t.tripNamePlaceholder}
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={(v) => { setName(v); setError(""); }}
                autoFocus
              />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.tripDescription}</Text>
              <TextInput
                className="border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white bg-white dark:bg-zinc-800"
                placeholder={t.tripDescriptionPlaceholder}
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.startDate}</Text>
                <DatePickerInput value={startDate} onChange={setStartDate} placeholder={t.noDate} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.endDate}</Text>
                <DatePickerInput value={endDate} onChange={setEndDate} placeholder={t.noDate} />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t.tripCurrency}</Text>
              <TextInput
                className="border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white bg-white dark:bg-zinc-800 w-24"
                placeholder="EUR"
                placeholderTextColor="#9ca3af"
                value={currency}
                onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                maxLength={3}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </ScrollView>

        <View className="px-5 pb-6 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-blue-600 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.updateTrip}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} className="py-3 items-center">
            <Text className="text-gray-500 dark:text-slate-400 text-sm">{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
