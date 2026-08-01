import { useState, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, Animated,
} from "react-native";
import { Tabs, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getTrip } from "@/db/trips";
import { SafeAreaView } from "react-native-safe-area-context";

const MORE_SECTIONS = [
  { name: "packing",   label: "Maleta de viaje",  icon: "briefcase-outline",      color: "#4f46e5" },
  { name: "documents", label: "Documentos",        icon: "document-text-outline",  color: "#0e7490" },
  { name: "tasks",     label: "Tareas del viaje",  icon: "checkmark-circle-outline", color: "#7c3aed" },
] as const;

export default function TripTabsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tripName, setTripName] = useState("Viaje");
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const trip = getTrip(Number(id));
      if (trip) setTripName(trip.name);
    }, [id])
  );

  function openSection(name: string) {
    setSheetOpen(false);
    router.push(`/trips/${id}/${name}`);
  }

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#f1f5f9" },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
          headerTitle: tripName,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-3">
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Vuelos",
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
            title: "Activ.",
            tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            title: "Gastos",
            tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} />,
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
                accessibilityLabel="Más secciones"
              />
            ),
          }}
        />
        <Tabs.Screen name="packing"   options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="tasks"     options={{ href: null }} />
        <Tabs.Screen name="edit"      options={{ href: null }} />
      </Tabs>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSheetOpen(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl px-4 pt-3 pb-2">
                <View className="w-10 h-1 bg-slate-200 rounded-full self-center mb-4" />
                <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Más secciones
                </Text>
                {MORE_SECTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.name}
                    onPress={() => openSection(s.name)}
                    className="flex-row items-center gap-4 px-2 py-4 border-b border-slate-50"
                  >
                    <View
                      className="w-11 h-11 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: s.color + "18" }}
                    >
                      <Ionicons name={s.icon as any} size={22} color={s.color} />
                    </View>
                    <Text className="text-base font-semibold text-slate-800">{s.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" style={{ marginLeft: "auto" }} />
                  </TouchableOpacity>
                ))}
                <SafeAreaView edges={["bottom"]} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
