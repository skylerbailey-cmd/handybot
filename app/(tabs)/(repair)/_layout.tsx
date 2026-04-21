import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function RepairStack() {
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
      <Stack.Screen name="index" options={{ title: "Repair" }} />
      <Stack.Screen
        name="new"
        options={{ title: "New Repair", presentation: "card" }}
      />
      <Stack.Screen
        name="issue/[id]"
        options={{ title: "Repair", headerBackTitle: "Back" }}
      />
      <Stack.Screen name="ask" options={{ title: "Ask HandyBot" }} />
      <Stack.Screen
        name="manual-repair"
        options={{ title: "Log a Repair", presentation: "card" }}
      />
    </Stack>
  );
}
