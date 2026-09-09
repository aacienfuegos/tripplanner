import { useMemo, useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { countryOptions, countryCodeToName } from "@tripplanner/shared";
import { useT } from "@/contexts/I18nContext";

interface Props {
  value: string | null;
  onChange: (code: string | null) => void;
}

export default function CountryPickerInput({ value, onChange }: Props) {
  const { t, lang } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const options = useMemo(() => countryOptions(lang), [lang]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const displayText = value ? countryCodeToName(value, lang) : null;

  function select(code: string | null) {
    onChange(code);
    setVisible(false);
    setSearch("");
  }

  return (
    <View>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className="border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 flex-row items-center justify-between bg-white dark:bg-zinc-900"
      >
        <Text className={displayText ? "text-base text-gray-900 dark:text-white" : "text-base text-gray-400"}>
          {displayText ?? t.countryNone}
        </Text>
        <Ionicons name="chevron-down" size={18} color={isDark ? "#71717a" : "#9ca3af"} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
        <View className="flex-1 bg-white dark:bg-zinc-950">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t.diveAreaCountry}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
            </TouchableOpacity>
          </View>
          <View className="px-5 pt-3 pb-2">
            <TextInput
              className="border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900"
              value={search}
              onChangeText={setSearch}
              placeholder={t.countrySearchPlaceholder}
              placeholderTextColor={isDark ? "#71717a" : "#9ca3af"}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !search.trim() ? (
                <TouchableOpacity onPress={() => select(null)} className="px-5 py-3 border-b border-gray-100 dark:border-zinc-900">
                  <Text className={!value ? "text-cyan-700 font-medium text-base" : "text-gray-700 dark:text-slate-300 text-base"}>
                    {t.countryNone}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => select(item.code)} className="px-5 py-3 border-b border-gray-100 dark:border-zinc-900">
                <Text className={value === item.code ? "text-cyan-700 font-medium text-base" : "text-gray-900 dark:text-white text-base"}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
