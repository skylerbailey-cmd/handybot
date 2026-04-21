import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function RemindersStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Reminders" }} />
      <Stack.Screen
        name="new"
        options={{ title: "New Reminder", presentation: "card" }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: "Edit Reminder", presentation: "card" }}
      />
    </Stack>
  );
}
