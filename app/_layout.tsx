import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ensureMultiHomeSetup } from "@/lib/homes";
import { ensureNotificationsConfigured } from "@/lib/reminders";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  /**
   * If the app was cold-started via a tapped notification, we get the
   * response here and need to replay the deep link once the router is
   * ready. We stash the pending reminderId so the cold-start effect can
   * run after navReady becomes true.
   */
  const pendingColdStartReminderId = useRef<string | null>(null);
  const handledColdStart = useRef(false);

  // One-time setup: multi-home migration + notification handler.
  useEffect(() => {
    ensureMultiHomeSetup().catch(() => {
      /* ignore — defaults to "default" home */
    });
    ensureNotificationsConfigured().catch(() => {
      /* ignore — we'll re-prompt when the user opens Reminders */
    });
  }, []);

  // Foreground / background notification taps.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const reminderId = extractReminderId(response);
        navigateToReminders(router, reminderId);
      }
    );
    return () => sub.remove();
  }, [router]);

  // Cold-start: app was launched by tapping a notification.
  useEffect(() => {
    if (handledColdStart.current) return;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) {
          handledColdStart.current = true;
          return;
        }
        pendingColdStartReminderId.current = extractReminderId(response);
      })
      .catch(() => {
        handledColdStart.current = true;
      });
  }, []);

  // Once the navigation state is ready, flush any pending cold-start deep link.
  useEffect(() => {
    if (!navReady || handledColdStart.current) return;
    handledColdStart.current = true;
    if (pendingColdStartReminderId.current !== null) {
      navigateToReminders(router, pendingColdStartReminderId.current);
      pendingColdStartReminderId.current = null;
    }
  }, [navReady, router]);

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
          <Stack.Screen
            name="ask"
            options={{ title: "Ask HandyBot" }}
          />
          <Stack.Screen
            name="inventory"
            options={{ title: "Home Inventory" }}
          />
          <Stack.Screen
            name="history"
            options={{ title: "Repair History" }}
          />
          <Stack.Screen name="homes" options={{ title: "My Homes" }} />
          <Stack.Screen name="reminders" options={{ title: "Reminders" }} />
          <Stack.Screen
            name="reminder/new"
            options={{ title: "New reminder", presentation: "card" }}
          />
          <Stack.Screen
            name="reminder/[id]"
            options={{ title: "Edit reminder", presentation: "card" }}
          />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function extractReminderId(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data as
    | { reminderId?: unknown }
    | undefined;
  if (data && typeof data.reminderId === "string") {
    return data.reminderId;
  }
  return null;
}

function navigateToReminders(
  router: ReturnType<typeof useRouter>,
  reminderId: string | null
) {
  try {
    if (reminderId) {
      router.push({
        pathname: "/reminders",
        params: { highlight: reminderId },
      });
    } else {
      router.push("/reminders");
    }
  } catch {
    /* router may not be ready yet — cold-start effect will retry */
  }
}
