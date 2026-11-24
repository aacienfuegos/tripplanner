import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "@/contexts/I18nContext";

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  count: number;
  onSelectAll: () => void;
  onMove: () => void;
  onMarkPacked: () => void;
  onUnmark: () => void;
  onDelete: () => void;
  onExit: () => void;
}

function BarButton({ icon, label, onPress, disabled, danger }: {
  icon: IconName; label: string; onPress: () => void; disabled?: boolean; danger?: boolean;
}) {
  const color = disabled ? "#94a3b8" : danger ? "#ef4444" : "#4f46e5";
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} className="items-center px-1 py-1 flex-1">
      <Ionicons name={icon} size={20} color={color} />
      <Text className="text-[10px] mt-0.5 text-center" style={{ color }} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SelectionBar({ count, onSelectAll, onMove, onMarkPacked, onUnmark, onDelete, onExit }: Props) {
  const { t } = useT();
  const none = count === 0;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-3 pt-2 pb-4"
      style={{ elevation: 8 }}
    >
      <View className="flex-row items-center justify-between mb-1 px-1">
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.selectedCount(count)}</Text>
        <TouchableOpacity onPress={onExit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm font-semibold text-indigo-600">{t.exitSelection}</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row">
        <BarButton icon="checkmark-done-outline" label={t.selectAll} onPress={onSelectAll} />
        <BarButton icon="briefcase-outline" label={t.moveToSuitcase} onPress={onMove} disabled={none} />
        <BarButton icon="checkbox-outline" label={t.markPacked} onPress={onMarkPacked} disabled={none} />
        <BarButton icon="square-outline" label={t.unmark} onPress={onUnmark} disabled={none} />
        <BarButton icon="trash-outline" label={t.delete} onPress={onDelete} disabled={none} danger />
      </View>
    </View>
  );
}
