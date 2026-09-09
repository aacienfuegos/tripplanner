import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onPress: () => void;
  color?: string;
  locked?: boolean;
}

export default function SectionFAB({ onPress, color = "#2563eb", locked = false }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-6 right-5 w-14 h-14 rounded-full items-center justify-center shadow-lg"
      style={{ backgroundColor: locked ? "#94a3b8" : color, elevation: 6 }}
      activeOpacity={0.85}
    >
      <Ionicons name={locked ? "lock-closed" : "add"} size={locked ? 22 : 28} color="white" />
    </TouchableOpacity>
  );
}
