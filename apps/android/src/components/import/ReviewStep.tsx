/**
 * Paso 3 del wizard: preview de todos los ítems con detección de duplicados.
 * El usuario puede deseleccionar ítems antes de confirmar la importación.
 *
 * Equivalente al ReviewStep.tsx de la web, adaptado para React Native.
 */
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ImportPayload,
  ImportFlight,
  ImportAccommodation,
  ImportActivity,
  ImportExpense,
  ImportPackingItem,
  ImportDocument,
} from "@tripplanner/shared";
import { checkDuplicates, bulkImport, DuplicateFlags, ImportResult } from "@/db/import";

interface Props {
  tripId: number;
  payload: ImportPayload;
  onBack: () => void;
  onDone: () => void;
}

type SectionKey = keyof ImportPayload;

const SECTION_LABELS: Record<SectionKey, string> = {
  flights: "Vuelos",
  accommodations: "Alojamientos",
  activities: "Actividades",
  expenses: "Gastos",
  packing: "Maleta",
  documents: "Documentos",
};

const SECTION_ICONS: Record<SectionKey, string> = {
  flights: "airplane-outline",
  accommodations: "bed-outline",
  activities: "walk-outline",
  expenses: "cash-outline",
  packing: "briefcase-outline",
  documents: "document-text-outline",
};

function itemLabel(section: SectionKey, item: ImportPayload[SectionKey][number]): string {
  switch (section) {
    case "flights": {
      const f = item as ImportFlight;
      return `${f.origin} → ${f.destination}${f.flightNumber ? ` (${f.flightNumber})` : ""}`;
    }
    case "accommodations": {
      const a = item as ImportAccommodation;
      return `${a.name} · ${a.city}`;
    }
    case "activities": {
      const a = item as ImportActivity;
      return a.name;
    }
    case "expenses": {
      const e = item as ImportExpense;
      return `${e.description} · ${e.amount} ${e.currency}`;
    }
    case "packing": {
      const p = item as ImportPackingItem;
      return `${p.name}${p.quantity > 1 ? ` ×${p.quantity}` : ""} (${p.category})`;
    }
    case "documents": {
      const d = item as ImportDocument;
      return `${d.name} · ${d.type}`;
    }
  }
}

export default function ReviewStep({ tripId, payload, onBack, onDone }: Props) {
  const [duplicates, setDuplicates] = useState<DuplicateFlags | null>(null);
  const [selected, setSelected] = useState<Record<SectionKey, boolean[]>>(() => {
    const s: Partial<Record<SectionKey, boolean[]>> = {};
    for (const key of Object.keys(payload) as SectionKey[]) {
      s[key] = (payload[key] as unknown[]).map(() => true);
    }
    return s as Record<SectionKey, boolean[]>;
  });
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkDuplicates(tripId, payload)
      .then((flags) => { if (!cancelled) setDuplicates(flags); })
      .catch(() => { if (!cancelled) setDuplicates(null); });
    return () => { cancelled = true; };
  }, [tripId, payload]);

  function toggleItem(section: SectionKey, index: number) {
    setSelected((prev) => {
      const copy = [...prev[section]];
      copy[index] = !copy[index];
      return { ...prev, [section]: copy };
    });
  }

  async function handleImport() {
    const filtered: ImportPayload = {} as ImportPayload;
    for (const key of Object.keys(payload) as SectionKey[]) {
      (filtered as Record<string, unknown[]>)[key] = (payload[key] as unknown[]).filter(
        (_, i) => selected[key][i]
      );
    }

    const total = Object.values(filtered).reduce((s, arr) => s + arr.length, 0);
    if (total === 0) {
      Alert.alert("Sin ítems seleccionados", "Selecciona al menos un ítem para importar.");
      return;
    }

    setImporting(true);
    try {
      const result: ImportResult = await bulkImport(tripId, filtered);
      const parts: string[] = [];
      if (result.flights > 0) parts.push(`${result.flights} vuelo${result.flights !== 1 ? "s" : ""}`);
      if (result.accommodations > 0) parts.push(`${result.accommodations} alojamiento${result.accommodations !== 1 ? "s" : ""}`);
      if (result.activities > 0) parts.push(`${result.activities} actividad${result.activities !== 1 ? "es" : ""}`);
      if (result.expenses > 0) parts.push(`${result.expenses} gasto${result.expenses !== 1 ? "s" : ""}`);
      if (result.packing > 0) parts.push(`${result.packing} ítem${result.packing !== 1 ? "s" : ""} de maleta`);
      if (result.documents > 0) parts.push(`${result.documents} documento${result.documents !== 1 ? "s" : ""}`);
      Alert.alert("¡Importado!", `Se han añadido: ${parts.join(", ")}.`, [
        { text: "Listo", onPress: onDone },
      ]);
    } catch (err) {
      Alert.alert("Error", "No se pudo completar la importación. Inténtalo de nuevo.");
    } finally {
      setImporting(false);
    }
  }

  const sections = (Object.keys(payload) as SectionKey[]).filter(
    (k) => (payload[k] as unknown[]).length > 0
  );

  const totalSelected = Object.values(selected).reduce(
    (s, arr) => s + arr.filter(Boolean).length,
    0
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4 py-4">
        {sections.map((section) => {
          const items = payload[section] as unknown[];
          const dups = duplicates?.[section] ?? items.map(() => false);

          return (
            <View key={section} className="mb-5">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name={SECTION_ICONS[section] as any} size={16} color="#6b7280" />
                <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {SECTION_LABELS[section]} ({items.length})
                </Text>
              </View>

              {items.map((item, i) => {
                const isDup = dups[i];
                const isSelected = selected[section][i];

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleItem(section, i)}
                    className={`flex-row items-start gap-3 px-3 py-2.5 rounded-xl mb-1.5 ${
                      isSelected ? "bg-white border border-gray-200" : "bg-gray-50 border border-gray-100 opacity-50"
                    }`}
                  >
                    <View
                      className={`mt-0.5 w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={12} color="white" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-gray-900">
                        {itemLabel(section, item as ImportPayload[SectionKey][number])}
                      </Text>
                      {isDup && (
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                            <Text className="text-xs text-amber-700">Posible duplicado</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <View className="px-4 pb-6 gap-3 border-t border-gray-100 pt-3">
        <TouchableOpacity
          onPress={handleImport}
          disabled={importing || totalSelected === 0}
          className={`rounded-xl py-3.5 flex-row items-center justify-center gap-2 ${
            totalSelected > 0 ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          {importing ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={18} color={totalSelected > 0 ? "white" : "#9ca3af"} />
              <Text className={`font-semibold text-base ${totalSelected > 0 ? "text-white" : "text-gray-400"}`}>
                Importar {totalSelected > 0 ? `${totalSelected} ítem${totalSelected !== 1 ? "s" : ""}` : ""}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} className="py-2 items-center">
          <Text className="text-gray-500 text-sm">← Volver a pegar JSON</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
