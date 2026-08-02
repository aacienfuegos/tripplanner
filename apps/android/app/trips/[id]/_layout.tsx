import { useState, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback,
} from "react-native";
import { Tabs, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { getTrip, isTripLocked } from "@/db/trips";
import { SafeAreaView } from "react-native-safe-area-context";
import { useT } from "@/contexts/I18nContext";
import { usePro } from "@/contexts/ProContext";
import { TripLockProvider } from "@/contexts/TripLockContext";

export default function TripTabsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const { isPro } = usePro();
  const { colorScheme } = useColorScheme();
  const [tripName, setTripName] = useState("Viaje");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const isDark = colorScheme === "dark";
  const headerBg = isDark ? "#18181b" : "#ffffff";
  const tabBg    = isDark ? "#18181b" : "#ffffff";
  const tabBorder = isDark ? "#27272a" : "#f1f5f9";
  const headerTint = isDark ? "#f1f5f9" : "#374151";

  const MORE_SECTIONS = [
    { name: "expenses",  label: t.expensesFull,  icon: "cash-outline",              color: "#059669" },
    { name: "packing",   label: t.packingFull,   icon: "briefcase-outline",         color: "#4f46e5" },
    { name: "documents", label: t.documentsFull, icon: "document-text-outline",     color: "#0e7490" },
    { name: "tasks",     label: t.tasksFull,     icon: "checkmark-circle-outline",  color: "#7c3aed" },
    { name: "dives",     label: t.dives,         icon: "water-outline",             color: "#0e7490" },
    { name: "map",       label: t.sectionMap,    icon: "map-outline",               color: "#2563eb" },
  ] as const;

  useFocusEffect(
    useCallback(() => {
      const trip = getTrip(Number(id));
      if (trip) setTripName(trip.name);
      setIsLocked(isTripLocked(Number(id), isPro));
    }, [id, isPro])
  );

  function openSection(name: string) {
    setSheetOpen(false);
    router.push(`/trips/${id}/${name}`);
  }

  return (
    <TripLockProvider isLocked={isLocked}>
      <View style={{ flex: 1 }}>
      {isLocked && (
        <View className="flex-row items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-900">
          <Ionicons name="lock-closed" size={14} color="#b45309" />
          <Text className="text-xs font-medium text-amber-700 dark:text-amber-400 flex-1">{t.tripLockedBanner}</Text>
        </View>
      )}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: isDark ? "#52525b" : "#94a3b8",
          tabBarStyle: { backgroundColor: tabBg, borderTopColor: tabBorder },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
          headerTitle: tripName,
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: headerTint },
          headerStyle: { backgroundColor: headerBg },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-3">
              <Ionicons name="arrow-back" size={24} color={headerTint} />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.overview,
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="flights"
          options={{
            title: t.flights,
            tabBarIcon: ({ color, size }) => <Ionicons name="airplane-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="accommodations"
          options={{
            title: "Alojam.",
            tabBarIcon: ({ color, size }) => <Ionicons name="bed-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="activities"
          options={{
            title: t.activities,
            tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "Más",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...(props as any)}
                onPress={() => setSheetOpen(true)}
                style={props.style}
                accessibilityLabel={t.moreSections}
              />
            ),
          }}
        />
        <Tabs.Screen name="expenses"       options={{ href: null }} />
        <Tabs.Screen name="packing"        options={{ href: null }} />
        <Tabs.Screen name="documents"      options={{ href: null }} />
        <Tabs.Screen name="tasks"          options={{ href: null }} />
        <Tabs.Screen name="dives"          options={{ href: null }} />
        <Tabs.Screen name="map"            options={{ href: null }} />
        <Tabs.Screen name="edit"           options={{ href: null }} />
      </Tabs>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSheetOpen(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className={`rounded-t-3xl px-4 pt-3 pb-2 ${isDark ? "bg-zinc-900" : "bg-white"}`}>
                <View className="w-10 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full self-center mb-4" />
                <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 mb-2">
                  {t.moreSections}
                </Text>
                {MORE_SECTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.name}
                    onPress={() => openSection(s.name)}
                    className="flex-row items-center gap-4 px-2 py-4 border-b border-slate-50 dark:border-zinc-800"
                  >
                    <View
                      className="w-11 h-11 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: s.color + "18" }}
                    >
                      <Ionicons name={s.icon as any} size={22} color={s.color} />
                    </View>
                    <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">{s.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={isDark ? "#52525b" : "#cbd5e1"} style={{ marginLeft: "auto" }} />
                  </TouchableOpacity>
                ))}
                <SafeAreaView edges={["bottom"]} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </TripLockProvider>
  );
}
