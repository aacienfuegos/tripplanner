import { Tabs, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTrip } from "@/db/trips";
import { useState, useCallback } from "react";

export default function TripTabsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tripName, setTripName] = useState("Viaje");

  useFocusEffect(
    useCallback(() => {
      const trip = getTrip(Number(id));
      if (trip) setTripName(trip.name);
    }, [id])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: { backgroundColor: "#ffffff" },
        headerTitle: tripName,
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accommodations"
        options={{
          title: "Alojam.",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bed-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activ.",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="walk-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Gastos",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="packing"
        options={{
          title: "Maleta",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Docs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tareas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="edit" options={{ href: null }} />
    </Tabs>
  );
}
