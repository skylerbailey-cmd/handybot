import { Stack, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { colors } from "@/lib/theme";

function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/(tabs)/(settings)")} hitSlop={8}>
      <Text style={{ fontSize: 22 }}>⚙️</Text>
    </Pressable>
  );
}

export default function HomeStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerRight: () => <SettingsButton />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
