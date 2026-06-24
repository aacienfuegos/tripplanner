import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TripsLayout() {
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Mis viajes",
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/settings")} className="mr-1 p-1">
              <Ionicons name="settings-outline" size={22} color="#374151" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="new"
        options={{ title: "Nuevo viaje", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
