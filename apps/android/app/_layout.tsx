import "../global.css";
// Hermes (Expo Go, RN 0.81) no trae Intl.DisplayNames ni Intl.Locale (del
// que depende) — necesarios para country-names.ts (código ISO -> nombre
// localizado, ver #264). Cada polyfill se auto-detecta y no hace nada si el
// motor ya lo soporta nativamente.
import "@formatjs/intl-locale/polyfill";
import "@formatjs/intl-displaynames/polyfill";
import "@formatjs/intl-displaynames/locale-data/es";
import "@formatjs/intl-displaynames/locale-data/en";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { ProProvider } from "@/contexts/ProContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { initDatabase } from "@/db/database";
import { seedDevData } from "@/db/seed";

function AppRoot() {
  const { colorScheme } = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDatabase();
    // Dataset rico reseedado en cada arranque en dev — mismo enfoque que la
    // web en staging (seed en cada boot), para tener siempre datos
    // realistas con los que probar sin depender de rellenar formularios.
    // No corre en builds de producción (__DEV__ es false ahí).
    if (__DEV__) {
      seedDevData().finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) return <View className="flex-1 bg-white dark:bg-zinc-950" />;

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
