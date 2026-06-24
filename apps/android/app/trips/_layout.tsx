import { Stack } from "expo-router";

export default function TripsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Mis viajes", headerShown: true }}
      />
      <Stack.Screen
        name="new"
        options={{ title: "Nuevo viaje", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
