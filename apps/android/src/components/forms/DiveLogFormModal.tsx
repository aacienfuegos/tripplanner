import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { createDiveLog, updateDiveLog, listDiveLogEquipmentIds, DiveLog, DiveLogInput } from "@/db/dive-logs";
import { listDiveSites, DiveSite } from "@/db/dive-sites";
import { listDiveEquipment, DiveEquipment } from "@/db/dive-equipment";
import DatePickerInput from "@/components/DatePickerInput";
import { useT } from "@/contexts/I18nContext";
import DiveSiteFormModal from "./DiveSiteFormModal";

const DIVE_TYPES = ["RECREATIONAL", "TRAINING", "NIGHT", "WRECK", "DRIFT", "DEEP", "CAVE", "FREEDIVE"] as const;
type DiveTypeKey = (typeof DIVE_TYPES)[number];
const GAS_MIXES: DiveLog["gas_mix"][] = ["AIR", "NITROX", "TRIMIX", "OXYGEN"];

interface Props {
  visible: boolean;
  tripId?: number | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: DiveLog;
}

export default function DiveLogFormModal({ visible, tripId, onClose, onSaved, onDelete, initialData }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [diveSiteId, setDiveSiteId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [depthMax, setDepthMax] = useState("");
  const [bottomTime, setBottomTime] = useState("");
  const [surfaceInterval, setSurfaceInterval] = useState("");
  const [gasMix, setGasMix] = useState<DiveLog["gas_mix"]>("AIR");
  const [o2Percentage, setO2Percentage] = useState("");
  const [heliumPercentage, setHeliumPercentage] = useState("");
  const [pressureStart, setPressureStart] = useState("");
  const [pressureEnd, setPressureEnd] = useState("");
  const [waterTemp, setWaterTemp] = useState("");
  const [airTemp, setAirTemp] = useState("");
  const [visibility, setVisibility] = useState("");
  const [diveType, setDiveType] = useState<DiveTypeKey | null>(null);
  const [buddyName, setBuddyName] = useState("");
  const [suitType, setSuitType] = useState("");
  const [weight, setWeight] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [sites, setSites] = useState<DiveSite[]>([]);
  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [equipment, setEquipment] = useState<DiveEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<number>>(new Set());

  const diveTypeLabels: Record<DiveTypeKey, string> = {
    RECREATIONAL: t.diveTypeRecreational, TRAINING: t.diveTypeTraining, NIGHT: t.diveTypeNight,
    WRECK: t.diveTypeWreck, DRIFT: t.diveTypeDrift, DEEP: t.diveTypeDeep, CAVE: t.diveTypeCave,
    FREEDIVE: t.diveTypeFreedive,
  };
  const gasMixLabels: Record<DiveLog["gas_mix"], string> = {
    AIR: t.gasMixAir, NITROX: t.gasMixNitrox, TRIMIX: t.gasMixTrimix, OXYGEN: t.gasMixOxygen,
  };

  useEffect(() => {
    if (!visible) return;
    setSites(listDiveSites());
    setEquipment(listDiveEquipment().filter((e) => e.status !== "WISHLIST"));

    if (initialData) {
      setDiveSiteId(initialData.dive_site_id);
      setDate(initialData.date.slice(0, 10));
      setTime(initialData.date.slice(11, 16));
      setDepthMax(String(initialData.depth_max));
      setBottomTime(String(initialData.bottom_time));
      setSurfaceInterval(initialData.surface_interval != null ? String(initialData.surface_interval) : "");
      setGasMix(initialData.gas_mix);
      setO2Percentage(initialData.o2_percentage != null ? String(initialData.o2_percentage) : "");
      setHeliumPercentage(initialData.helium_percentage != null ? String(initialData.helium_percentage) : "");
      setPressureStart(initialData.pressure_start != null ? String(initialData.pressure_start) : "");
      setPressureEnd(initialData.pressure_end != null ? String(initialData.pressure_end) : "");
      setWaterTemp(initialData.water_temp != null ? String(initialData.water_temp) : "");
      setAirTemp(initialData.air_temp != null ? String(initialData.air_temp) : "");
      setVisibility(initialData.visibility != null ? String(initialData.visibility) : "");
      setDiveType((initialData.dive_type as DiveTypeKey) ?? null);
      setBuddyName(initialData.buddy_name ?? "");
      setSuitType(initialData.suit_type ?? "");
      setWeight(initialData.weight != null ? String(initialData.weight) : "");
      setRating(initialData.rating ?? 0);
      setNotes(initialData.notes ?? "");
      setSelectedEquipment(new Set(listDiveLogEquipmentIds(initialData.id)));
    } else {
      setDiveSiteId(null);
      setDate(new Date().toISOString().slice(0, 10));
      setTime("");
      setDepthMax(""); setBottomTime(""); setSurfaceInterval("");
      setGasMix("AIR"); setO2Percentage(""); setHeliumPercentage("");
      setPressureStart(""); setPressureEnd(""); setWaterTemp(""); setAirTemp(""); setVisibility("");
      setDiveType(null); setBuddyName(""); setSuitType(""); setWeight(""); setRating(0); setNotes("");
      setSelectedEquipment(new Set());
    }
    setError("");
  }, [visible, initialData]);

  function toggleEquipment(id: number) {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!date) { setError(t.diveDate); return; }
    if (!depthMax) { setError(t.diveDepthMax); return; }
    if (!bottomTime) { setError(t.diveBottomTime); return; }

    const data: DiveLogInput = {
      trip_id: tripId ?? initialData?.trip_id ?? null,
      dive_site_id: diveSiteId,
      date: `${date}T${time || "00:00"}:00`,
      depth_max: parseFloat(depthMax),
      bottom_time: parseInt(bottomTime, 10),
      surface_interval: surfaceInterval ? parseInt(surfaceInterval, 10) : null,
      gas_mix: gasMix,
      o2_percentage: o2Percentage ? parseInt(o2Percentage, 10) : null,
      helium_percentage: heliumPercentage ? parseInt(heliumPercentage, 10) : null,
      pressure_start: pressureStart ? parseInt(pressureStart, 10) : null,
      pressure_end: pressureEnd ? parseInt(pressureEnd, 10) : null,
      water_temp: waterTemp ? parseFloat(waterTemp) : null,
      air_temp: airTemp ? parseFloat(airTemp) : null,
      visibility: visibility ? parseFloat(visibility) : null,
      dive_type: diveType,
      buddy_name: buddyName.trim() || null,
      suit_type: suitType.trim() || null,
      weight: weight ? parseFloat(weight) : null,
      notes: notes.trim() || null,
      rating: rating || null,
      equipmentIds: Array.from(selectedEquipment),
    };

    if (initialData) updateDiveLog(initialData.id, data);
    else createDiveLog(data);
    onSaved();
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";
  const label = "text-sm font-medium text-gray-700 dark:text-slate-300 mb-1";
  const groupLabel = "text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mt-2";

  function Chip({ selected, label: chipLabel, onPress }: { selected: boolean; label: string; onPress: () => void }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className={`px-3 py-1.5 rounded-full border ${selected ? "bg-cyan-700 border-cyan-700" : "border-gray-300 dark:border-zinc-700"}`}
      >
        <Text className={selected ? "text-white text-sm font-medium" : "text-gray-700 dark:text-slate-300 text-sm font-medium"}>
          {chipLabel}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editDive : t.addDive}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <Text className={groupLabel}>{t.diveGroupBasic}</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.diveDate} *</Text>
                <DatePickerInput value={date} onChange={setDate} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.diveTime}</Text>
                <TextInput className={inputClass} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={isDark ? "#52525b" : "#9ca3af"} />
              </View>
            </View>
            <View>
              <Text className={label}>{t.diveSite}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <Chip selected={diveSiteId === null} label={t.diveSiteNone} onPress={() => setDiveSiteId(null)} />
                  {sites.map((s) => (
                    <Chip key={s.id} selected={diveSiteId === s.id} label={s.name} onPress={() => setDiveSiteId(s.id)} />
                  ))}
                  <TouchableOpacity onPress={() => setSiteFormOpen(true)} className="px-3 py-1.5 rounded-full border border-dashed border-cyan-700">
                    <Text className="text-cyan-700 text-sm font-medium">{t.diveSiteCreateNew}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.diveDepthMax} *</Text>
                <TextInput className={inputClass} value={depthMax} onChangeText={(v) => { setDepthMax(v); setError(""); }} keyboardType="decimal-pad" />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.diveBottomTime} *</Text>
                <TextInput className={inputClass} value={bottomTime} onChangeText={(v) => { setBottomTime(v); setError(""); }} keyboardType="number-pad" />
              </View>
            </View>
            {error ? <Text className="text-xs text-red-500">{error}</Text> : null}

            <Text className={groupLabel}>{t.diveGroupProfile}</Text>
            <View>
              <Text className={label}>{t.diveGasMix}</Text>
              <View className="flex-row gap-2 flex-wrap">
                {GAS_MIXES.map((g) => (
                  <Chip key={g} selected={gasMix === g} label={gasMixLabels[g]} onPress={() => setGasMix(g)} />
                ))}
              </View>
            </View>
            {(gasMix === "NITROX" || gasMix === "TRIMIX") && (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className={label}>{t.diveO2Percentage}</Text>
                  <TextInput className={inputClass} value={o2Percentage} onChangeText={setO2Percentage} keyboardType="number-pad" />
                </View>
                {gasMix === "TRIMIX" && (
                  <View className="flex-1">
                    <Text className={label}>{t.diveHeliumPercentage}</Text>
                    <TextInput className={inputClass} value={heliumPercentage} onChangeText={setHeliumPercentage} keyboardType="number-pad" />
                  </View>
                )}
              </View>
            )}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.divePressureStart}</Text>
                <TextInput className={inputClass} value={pressureStart} onChangeText={setPressureStart} keyboardType="number-pad" />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.divePressureEnd}</Text>
                <TextInput className={inputClass} value={pressureEnd} onChangeText={setPressureEnd} keyboardType="number-pad" />
              </View>
            </View>
            <View>
              <Text className={label}>{t.diveSurfaceInterval}</Text>
              <TextInput className={inputClass} value={surfaceInterval} onChangeText={setSurfaceInterval} keyboardType="number-pad" />
            </View>

            <Text className={groupLabel}>{t.diveGroupConditions}</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.diveWaterTemp}</Text>
                <TextInput className={inputClass} value={waterTemp} onChangeText={setWaterTemp} keyboardType="decimal-pad" />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.diveAirTemp}</Text>
                <TextInput className={inputClass} value={airTemp} onChangeText={setAirTemp} keyboardType="decimal-pad" />
              </View>
            </View>
            <View>
              <Text className={label}>{t.diveVisibility}</Text>
              <TextInput className={inputClass} value={visibility} onChangeText={setVisibility} keyboardType="decimal-pad" />
            </View>
            <View>
              <Text className={label}>{t.diveType}</Text>
              <View className="flex-row gap-2 flex-wrap">
                <Chip selected={diveType === null} label={t.diveTypeNone} onPress={() => setDiveType(null)} />
                {DIVE_TYPES.map((dt) => (
                  <Chip key={dt} selected={diveType === dt} label={diveTypeLabels[dt]} onPress={() => setDiveType(dt)} />
                ))}
              </View>
            </View>

            <Text className={groupLabel}>{t.diveGroupNotes}</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className={label}>{t.diveBuddyName}</Text>
                <TextInput className={inputClass} value={buddyName} onChangeText={setBuddyName} />
              </View>
              <View className="flex-1">
                <Text className={label}>{t.diveSuitType}</Text>
                <TextInput className={inputClass} value={suitType} onChangeText={setSuitType} />
              </View>
            </View>
            <View>
              <Text className={label}>{t.diveWeight}</Text>
              <TextInput className={inputClass} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
            </View>
            <View>
              <Text className={label}>{t.diveRating}</Text>
              <View className="flex-row gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(rating === n ? 0 : n)}>
                    <Ionicons name={n <= rating ? "star" : "star-outline"} size={26} color="#f59e0b" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {equipment.length > 0 && (
              <View>
                <Text className={label}>{t.diveEquipmentUsed}</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {equipment.map((e) => (
                    <Chip key={e.id} selected={selectedEquipment.has(e.id)} label={e.name} onPress={() => toggleEquipment(e.id)} />
                  ))}
                </View>
              </View>
            )}

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
              onPress={() => Alert.alert(t.editDive, t.confirmDeleteDive, [
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

      <DiveSiteFormModal
        visible={siteFormOpen}
        onClose={() => setSiteFormOpen(false)}
        onSaved={(site) => {
          setSites((prev) => [...prev, site].sort((a, b) => a.name.localeCompare(b.name)));
          setDiveSiteId(site.id);
          setSiteFormOpen(false);
        }}
      />
    </Modal>
  );
}
