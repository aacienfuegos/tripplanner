import { View, Text, Switch, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { usePro } from "@/contexts/ProContext";
import { useT } from "@/contexts/I18nContext";
import { useTheme, ThemePreference } from "@/contexts/ThemeContext";
import type { Lang } from "@/contexts/I18nContext";

function OptionSelector<T extends string>({
  options, value, onChange, isDark,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  isDark: boolean;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-xl items-center border ${
              active
                ? "bg-blue-600 border-blue-600"
                : isDark
                  ? "bg-zinc-800 border-zinc-700"
                  : "bg-slate-50 border-slate-200"
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? "text-white" : isDark ? "text-slate-300" : "text-slate-600"}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { isPro, setIsPro } = usePro();
  const { t, lang, setLang } = useT();
  const { preference, setPreference } = useTheme();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t.themeSystem },
    { value: "light",  label: t.themeLight },
    { value: "dark",   label: t.themeDark },
  ];

  const langOptions: { value: Lang; label: string }[] = [
    { value: "es", label: t.langEs },
    { value: "en", label: t.langEn },
  ];

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: t.settings, headerShown: true,
        headerStyle: { backgroundColor: isDark ? "#18181b" : "#ffffff" },
        headerTintColor: isDark ? "#f1f5f9" : "#374151",
        headerTitleStyle: { fontWeight: "700" },
      }} />
      <ScrollView className="flex-1">

        {/* Plan */}
        <View className="mx-4 mt-6 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm">
          <View className="px-4 py-3 border-b border-slate-50 dark:border-zinc-800">
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{t.plan}</Text>
          </View>
          <View className="px-4 py-4">
            {isPro ? (
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 bg-blue-50 dark:bg-blue-950 rounded-2xl items-center justify-center">
                  <Ionicons name="star" size={22} color="#2563eb" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white">{t.proPlan}</Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400">{t.proPlanDesc}</Text>
                </View>
                <View className="bg-blue-50 dark:bg-blue-950 rounded-full px-3 py-1">
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">{t.proActive}</Text>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-11 h-11 bg-slate-100 dark:bg-zinc-800 rounded-2xl items-center justify-center">
                    <Ionicons name="person-outline" size={22} color={isDark ? "#71717a" : "#64748b"} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-slate-900 dark:text-white">{t.freePlan}</Text>
                    <Text className="text-sm text-slate-500 dark:text-slate-400">{t.freePlanDesc}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert(t.comingSoon, t.upgradeComingSoonMsg, [{ text: t.understood }])}
                  className="rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: "#2563eb" }}
                >
                  <Ionicons name="star-outline" size={18} color="white" />
                  <Text className="text-white font-bold text-base">{t.upgradeToProBtn}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Appearance */}
        <View className="mx-4 mt-4 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm">
          <View className="px-4 py-3 border-b border-slate-50 dark:border-zinc-800">
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{t.appearance}</Text>
          </View>
          <View className="px-4 py-4 gap-4">
            <View>
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t.appearance}</Text>
              <OptionSelector
                options={themeOptions}
                value={preference}
                onChange={setPreference}
                isDark={isDark}
              />
            </View>
            <View>
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t.language}</Text>
              <OptionSelector
                options={langOptions}
                value={lang}
                onChange={setLang}
                isDark={isDark}
              />
            </View>
          </View>
        </View>

        {/* DEV toggle */}
        {__DEV__ && (
          <View className="mx-4 mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="code-slash-outline" size={16} color={isDark ? "#fbbf24" : "#92400e"} />
              <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t.devSimulatePro}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-amber-700 dark:text-amber-400">isPro</Text>
              <Switch
                value={isPro}
                onValueChange={setIsPro}
                trackColor={{ false: "#d1d5db", true: "#2563eb" }}
              />
            </View>
          </View>
        )}

        {/* Information */}
        <View className="mx-4 mt-4 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm">
          <View className="px-4 py-3 border-b border-slate-50 dark:border-zinc-800">
            <Text className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{t.information}</Text>
          </View>
          <View className="px-4 py-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-slate-700 dark:text-slate-200">{t.version}</Text>
              <Text className="text-sm text-slate-400 dark:text-slate-500">1.0.0</Text>
            </View>
            <View className="flex-row items-center gap-2 pt-1 border-t border-slate-50 dark:border-zinc-800">
              <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
              <Text className="text-xs text-slate-400 dark:text-slate-500 flex-1">{t.localDataNote}</Text>
            </View>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
