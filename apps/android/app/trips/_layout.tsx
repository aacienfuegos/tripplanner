import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useT } from "@/contexts/I18nContext";
import ModuleSwitcherHeader from "@/components/ModuleSwitcherHeader";

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
          headerShown: true,
          headerTitle: () => <ModuleSwitcherHeader current="trips" />,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/settings")} className="mr-1 p-1">
              <Ionicons name="settings-outline" size={22} color={headerTint} />
            </TouchableOpacity>
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
