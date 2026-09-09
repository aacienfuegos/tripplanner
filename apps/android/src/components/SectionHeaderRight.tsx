import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";

interface Props {
  tripId: string | undefined;
  onImportPress: () => void;
  locked?: boolean;
  onLockedPress?: () => void;
}

export default function SectionHeaderRight({ tripId, onImportPress, locked = false, onLockedPress }: Props) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColor = locked ? (colorScheme === "dark" ? "#52525b" : "#cbd5e1") : (colorScheme === "dark" ? "#94a3b8" : "#374151");
  const activeIconColor = colorScheme === "dark" ? "#94a3b8" : "#374151";

  return (
    <View className="flex-row items-center gap-4 mr-3">
      {tripId && (
        <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/map`)}>
          <Ionicons name="map-outline" size={20} color={activeIconColor} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={locked ? onLockedPress : onImportPress}>
        <Ionicons name="sparkles-outline" size={20} color={iconColor} />
      </TouchableOpacity>
      {tripId && (
        <TouchableOpacity onPress={locked ? onLockedPress : () => router.push(`/trips/${tripId}/edit`)}>
          <Ionicons name={locked ? "lock-closed-outline" : "create-outline"} size={22} color={iconColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}
