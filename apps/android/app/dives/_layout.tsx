import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useT } from "@/contexts/I18nContext";
import ModuleSwitcherHeader from "@/components/ModuleSwitcherHeader";

export default function DivesTabsLayout() {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerBg = isDark ? "#18181b" : "#ffffff";
  const tabBg = isDark ? "#18181b" : "#ffffff";
  const tabBorder = isDark ? "#27272a" : "#f1f5f9";
  const headerTint = isDark ? "#f1f5f9" : "#374151";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0891b2",
        tabBarInactiveTintColor: isDark ? "#52525b" : "#94a3b8",
        tabBarStyle: { backgroundColor: tabBg, borderTopColor: tabBorder },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        headerTitle: () => <ModuleSwitcherHeader current="dives" />,
        headerTitleStyle: { fontWeight: "700", fontSize: 17, color: headerTint },
        headerStyle: { backgroundColor: headerBg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.diveLogsTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sites"
        options={{
          title: t.diveSitesTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="equipment"
        options={{
          title: t.diveEquipmentTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="certifications"
        options={{
          title: t.diveCertificationsTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="ribbon-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t.diveStatsTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="equipment-detail" options={{ href: null }} />
      <Tabs.Screen name="site-detail" options={{ href: null }} />
      <Tabs.Screen name="dive-detail" options={{ href: null }} />
    </Tabs>
  );
}
