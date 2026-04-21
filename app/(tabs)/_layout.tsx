import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="(inventory)"
        options={{
          title: "Inventory",
          tabBarIcon: () => <TabIcon emoji="📦" />,
        }}
      />
      <Tabs.Screen
        name="(reminders)"
        options={{
          title: "Reminders",
          tabBarIcon: () => <TabIcon emoji="🔔" />,
        }}
      />
      <Tabs.Screen
        name="(repair)"
        options={{
          title: "Repair",
          tabBarIcon: () => <TabIcon emoji="🔧" />,
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: "Settings",
          tabBarIcon: () => <TabIcon emoji="⚙️" />,
        }}
      />
    </Tabs>
  );
}
