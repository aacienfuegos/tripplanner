import { View, Text, TextInput, TouchableOpacity, Switch, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useT } from "@/contexts/I18nContext";

export type PackingView = "category" | "suitcase";

type IconName = keyof typeof Ionicons.glyphMap;

const COLOR = "#4f46e5";
const DONE = "#059669";

interface Action {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface Props {
  packed: number;
  total: number;
  showFilters: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  view: PackingView;
  onViewChange: (v: PackingView) => void;
  onlyPending: boolean;
  onOnlyPendingChange: (v: boolean) => void;
  actions: readonly Action[];
  notice?: string;
}

export default function PackingListHeader({
  packed, total, showFilters, query, onQueryChange, view, onViewChange,
  onlyPending, onOnlyPendingChange, actions, notice,
}: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
  const barColor = pct === 100 ? DONE : COLOR;

  return (
    <View className="pt-3 gap-3">
      {total > 0 && (
        <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm" style={{ borderLeftWidth: 3, borderLeftColor: COLOR }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.packingReady}</Text>
            <Text className="text-sm font-bold" style={{ color: barColor }}>
              {packed}/{total}  ·  {pct}%
            </Text>
          </View>
          <View className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </View>
          {pct === 100 && (
            <Text className="text-xs text-emerald-600 font-medium mt-1.5">{t.packingDone}</Text>
          )}
        </View>
      )}

      {showFilters && (
        <>
          <View className="flex-row items-center bg-white dark:bg-zinc-900 rounded-xl px-3 border border-slate-200 dark:border-zinc-800">
            <Ionicons name="search" size={16} color={isDark ? "#71717a" : "#94a3b8"} />
            <TextInput
              className="flex-1 py-2.5 px-2 text-base text-slate-900 dark:text-white"
              placeholder={t.search}
              placeholderTextColor={isDark ? "#71717a" : "#94a3b8"}
              value={query}
              onChangeText={onQueryChange}
            />
            {query !== "" && (
              <TouchableOpacity onPress={() => onQueryChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={isDark ? "#71717a" : "#94a3b8"} />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
            {([["category", t.packingByCategory], ["suitcase", t.packingBySuitcase]] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => onViewChange(value)}
                className={`flex-1 py-2 rounded-lg items-center ${view === value ? "bg-white dark:bg-zinc-900" : ""}`}
              >
                <Text className={`text-sm font-semibold ${view === value ? "text-indigo-600" : "text-slate-500 dark:text-slate-400"}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center justify-between px-1">
            <Text className="text-sm text-slate-700 dark:text-slate-200">{t.onlyPending}</Text>
            <Switch
              value={onlyPending}
              onValueChange={onOnlyPendingChange}
              trackColor={{ false: isDark ? "#3f3f46" : "#e2e8f0", true: COLOR }}
              thumbColor="#ffffff"
            />
          </View>
        </>
      )}

      {actions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              onPress={a.onPress}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border border-indigo-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <Ionicons name={a.icon} size={15} color={COLOR} />
              <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {notice ? (
        <Text className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">{notice}</Text>
      ) : null}
    </View>
  );
}
