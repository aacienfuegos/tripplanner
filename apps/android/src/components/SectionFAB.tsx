import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onPress: () => void;
  color?: string;
}

export default function SectionFAB({ onPress, color = "#2563eb" }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-6 right-5 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      style={{ backgroundColor: color, elevation: 6 }}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={28} color="white" />
    </TouchableOpacity>
  );
}
