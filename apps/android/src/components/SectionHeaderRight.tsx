import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";

interface Props {
  tripId: string | undefined;
  onImportPress: () => void;
}

export default function SectionHeaderRight({ tripId, onImportPress }: Props) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#94a3b8" : "#374151";
  return (
    <View className="flex-row items-center gap-4 mr-3">
      <TouchableOpacity onPress={onImportPress}>
        <Ionicons name="sparkles-outline" size={20} color={iconColor} />
      </TouchableOpacity>
      {tripId && (
        <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/edit`)}>
          <Ionicons name="create-outline" size={22} color={iconColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}
