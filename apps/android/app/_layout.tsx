import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { ProProvider } from "@/contexts/ProContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { initDatabase } from "@/db/database";

function AppRoot() {
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <ProProvider>
            <AppRoot />
          </ProProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
