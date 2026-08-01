import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useT } from "@/contexts/I18nContext";

export default function TripsLayout() {
  const router = useRouter();
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerBg = isDark ? "#18181b" : "#ffffff";
  const headerTint = isDark ? "#f1f5f9" : "#374151";

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerTint,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t.trips,
          headerShown: true,
          headerRight: () => (
            <>
              <TouchableOpacity onPress={() => router.push("/dives")} className="p-1" accessibilityLabel={t.dives}>
                <Ionicons name="water-outline" size={22} color={headerTint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/settings")} className="mr-1 p-1">
                <Ionicons name="settings-outline" size={22} color={headerTint} />
              </TouchableOpacity>
            </>
          ),
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: t.newTrip,
          presentation: "modal",
          headerStyle: { backgroundColor: headerBg },
          headerTintColor: headerTint,
        }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
