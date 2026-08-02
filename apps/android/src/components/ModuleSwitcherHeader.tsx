import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useT } from "@/contexts/I18nContext";

type ModuleKey = "trips" | "dives";

function ModuleIcon({ moduleKey, color }: { moduleKey: ModuleKey; color: string }) {
  return moduleKey === "trips"
    ? <Ionicons name="airplane-outline" size={20} color={color} />
    : <MaterialCommunityIcons name="diving-snorkel" size={20} color={color} />;
}

export default function ModuleSwitcherHeader({ current }: { current: ModuleKey }) {
  const router = useRouter();
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerTint = isDark ? "#f1f5f9" : "#374151";
  const [open, setOpen] = useState(false);

  const MODULES = [
    { key: "trips" as const, label: t.trips, route: "/trips" as const },
    { key: "dives" as const, label: t.dives, route: "/dives" as const },
  ];

  function select(module: (typeof MODULES)[number]) {
    setOpen(false);
    // replace, no push: cambiar de módulo no debe apilar pantallas -- cada
    // módulo se siente como su propio home, no como una ruta dentro del otro.
    if (module.key !== current) router.replace(module.route);
  }

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} className="flex-row items-center gap-2" activeOpacity={0.7}>
        <ModuleIcon moduleKey={current} color={headerTint} />
        <Text style={{ color: headerTint, fontWeight: "700", fontSize: 17 }}>
          {current === "trips" ? t.trips : t.dives}
        </Text>
        <Ionicons name="chevron-down" size={16} color={headerTint} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/30">
            <View className={`mx-4 mt-16 rounded-2xl overflow-hidden shadow-lg ${isDark ? "bg-zinc-900" : "bg-white"}`}>
              {MODULES.map((m, i) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => select(m)}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${i < MODULES.length - 1 ? "border-b border-slate-50 dark:border-zinc-800" : ""}`}
                >
                  <ModuleIcon moduleKey={m.key} color={m.key === current ? "#2563eb" : headerTint} />
                  <Text
                    className={m.key === current ? "text-blue-600 font-semibold text-base flex-1" : "text-slate-700 dark:text-slate-200 text-base flex-1"}
                  >
                    {m.label}
                  </Text>
                  {m.key === current && <Ionicons name="checkmark" size={18} color="#2563eb" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
