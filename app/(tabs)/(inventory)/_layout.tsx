import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function InventoryStack() {
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
      <Stack.Screen name="index" options={{ title: "Home Inventory" }} />
      <Stack.Screen
        name="edit"
        options={{ title: "Edit Item", presentation: "card" }}
      />
      <Stack.Screen
        name="insurance-export"
        options={{ title: "Insurance Export", presentation: "card" }}
      />
    </Stack>
  );
}
