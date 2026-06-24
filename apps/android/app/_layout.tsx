import "../global.css";
import { useEffect } from "react";
import { Platform, View, Text } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProProvider } from "@/contexts/ProContext";
import { initDatabase } from "@/db/database";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") initDatabase();
  }, []);

  if (Platform.OS === "web") {
    return (
      <View className="flex-1 items-center justify-center bg-white p-8">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          TripPlanner
        </Text>
        <Text className="text-base text-gray-600 text-center">
          Esta app está diseñada para Android.{"\n"}
          Descárgala desde la Play Store o escanea el QR con Expo Go.{"\n\n"}
          Para la versión web completa visita la app web.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ProProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </ProProvider>
    </SafeAreaProvider>
  );
}
