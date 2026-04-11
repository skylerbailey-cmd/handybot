import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "HandyBot" }} />
          <Stack.Screen
            name="new"
            options={{ title: "New repair", presentation: "card" }}
          />
          <Stack.Screen
            name="issue/[id]"
            options={{ title: "Repair", headerBackTitle: "Back" }}
          />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
