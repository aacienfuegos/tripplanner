import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface Props {
  tripId: string;
  onImportPress: () => void;
}

export default function SectionHeaderRight({ tripId, onImportPress }: Props) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-4 mr-3">
      <TouchableOpacity onPress={onImportPress}>
        <Ionicons name="sparkles-outline" size={20} color="#6b7280" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push(`/trips/${tripId}/edit`)}>
        <Ionicons name="create-outline" size={22} color="#374151" />
      </TouchableOpacity>
    </View>
  );
}
