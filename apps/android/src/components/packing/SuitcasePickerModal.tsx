import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import type { Suitcase } from "@/db/suitcases";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  suitcases: readonly Suitcase[];
  onClose: () => void;
  onPick: (suitcaseId: number | null) => void;
}

export default function SuitcasePickerModal({ visible, suitcases, onClose, onPick }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const options = [{ id: null, name: t.noSuitcase }, ...suitcases];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t.pickSuitcase}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {options.map((s) => (
            <TouchableOpacity
              key={s.id ?? "none"}
              onPress={() => onPick(s.id)}
              className="flex-row items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <Ionicons name={s.id === null ? "remove-circle-outline" : "briefcase-outline"} size={20} color="#4f46e5" />
              <Text className="flex-1 text-base text-gray-900 dark:text-white">{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
