import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function SettingsStack() {
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
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="homes" options={{ title: "My Homes" }} />
    </Stack>
  );
}
