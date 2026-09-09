import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { createDiveSite, updateDiveSite, DiveSite } from "@/db/dive-sites";
import { listDiveAreas, DiveArea } from "@/db/dive-areas";
import { geocodeQuery } from "@/lib/geocode";
import { countryCodeToName } from "@tripplanner/shared";
import { useT } from "@/contexts/I18nContext";
import DiveAreaFormModal from "./DiveAreaFormModal";
import CountryPickerInput from "@/components/CountryPickerInput";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: (site: DiveSite) => void;
  onDelete?: () => void;
  initialData?: DiveSite;
}

export default function DiveSiteFormModal({ visible, onClose, onSaved, onDelete, initialData }: Props) {
  const { t, lang } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [name, setName] = useState("");
  const [diveAreaId, setDiveAreaId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [areas, setAreas] = useState<DiveArea[]>([]);
  const [areaFormOpen, setAreaFormOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setAreas(listDiveAreas());
      setName(initialData?.name ?? "");
      setDiveAreaId(initialData?.dive_area_id ?? null);
      setAddress(initialData?.address ?? "");
      setCountry(initialData?.country ?? null);
      setRegion(initialData?.region ?? "");
      setNotes(initialData?.notes ?? "");
      setError("");
    }
  }, [visible, initialData]);

  async function handleSave() {
    if (!name.trim()) { setError(t.diveSiteName); return; }

    // Sólo geocodifica si el punto todavía no tiene coordenadas — evita
    // pegarle a Nominatim en cada edición de un punto ya localizado.
    let latitude = initialData?.latitude ?? null;
    let longitude = initialData?.longitude ?? null;
    if (latitude === null || longitude === null) {
      const countryName = country ? countryCodeToName(country, lang) : null;
      const query = [name, address, region, countryName].map((v) => v?.trim()).filter(Boolean).join(", ");
      const geocoded = await geocodeQuery(query);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    const data = {
      dive_area_id: diveAreaId,
      name: name.trim(),
      address: address.trim() || null,
      country,
      region: region.trim() || null,
      latitude,
      longitude,
      notes: notes.trim() || null,
      // max_depth/water_type no son editables aquí (igual que en la web,
      // solo llegan vía importación) — se preservan al editar.
      max_depth: initialData?.max_depth ?? null,
      water_type: initialData?.water_type ?? null,
    };
    const site = initialData
      ? (updateDiveSite(initialData.id, data), { ...initialData, ...data })
      : createDiveSite(data);
    onSaved(site);
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";
  const label = "text-sm font-medium text-gray-700 dark:text-slate-300 mb-1";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editDiveSite : t.addDiveSite}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className={label}>{t.diveSiteName} *</Text>
              <TextInput className={inputClass} value={name} onChangeText={(v) => { setName(v); setError(""); }} autoFocus />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>

            <View>
              <Text className={label}>{t.diveAreaLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setDiveAreaId(null)}
                    className={`px-3 py-1.5 rounded-full border ${diveAreaId === null ? "bg-cyan-700 border-cyan-700" : "border-gray-300 dark:border-zinc-700"}`}
                  >
                    <Text className={diveAreaId === null ? "text-white text-sm font-medium" : "text-gray-700 dark:text-slate-300 text-sm font-medium"}>
                      {t.diveAreaNone}
                    </Text>
                  </TouchableOpacity>
                  {areas.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setDiveAreaId(a.id)}
                      className={`px-3 py-1.5 rounded-full border ${diveAreaId === a.id ? "bg-cyan-700 border-cyan-700" : "border-gray-300 dark:border-zinc-700"}`}
                    >
                      <Text className={diveAreaId === a.id ? "text-white text-sm font-medium" : "text-gray-700 dark:text-slate-300 text-sm font-medium"}>
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setAreaFormOpen(true)} className="px-3 py-1.5 rounded-full border border-dashed border-cyan-700">
                    <Text className="text-cyan-700 text-sm font-medium">{t.diveAreaCreateNew}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            <View>
              <Text className={label}>{t.diveSiteAddress}</Text>
              <TextInput className={inputClass} value={address} onChangeText={setAddress} />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.diveSiteCountry}</Text>
                <CountryPickerInput value={country} onChange={setCountry} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.diveSiteRegion}</Text>
                <TextInput className={inputClass} value={region} onChangeText={setRegion} />
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
              onPress={() => Alert.alert(t.editDiveSite, t.confirmDeleteDiveSite, [
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

      <DiveAreaFormModal
        visible={areaFormOpen}
        onClose={() => setAreaFormOpen(false)}
        onSaved={(area) => {
          setAreas((prev) => [...prev, area].sort((a, b) => a.name.localeCompare(b.name)));
          setDiveAreaId(area.id);
          setAreaFormOpen(false);
        }}
      />
    </Modal>
  );
}
