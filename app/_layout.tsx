import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getSession } from "@/lib/auth";
import { recallSyncOnLaunch } from "@/lib/cloud/recallSync";
import { restoreMissingImages } from "@/lib/cloud/restoreImages";
import { ensureMultiHomeSetup } from "@/lib/homes";
import { registerPushToken } from "@/lib/pushToken";
import { ensureNotificationsConfigured } from "@/lib/reminders";
import { seedDemoData } from "@/lib/seedData";
import { hydrateSubscription } from "@/lib/subscription";

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const pendingColdStartReminderId = useRef<string | null>(null);
  const handledColdStart = useRef(false);

  useEffect(() => {
    ensureMultiHomeSetup()
      .then(() => seedDemoData())
      .catch(() => {});
    ensureNotificationsConfigured().catch(() => {});
    // Hydrate the Supabase auth session so it's ready before any screen
    // tries to check login state (e.g. Settings → Cloud Backup).
    getSession().catch(() => {});
    hydrateSubscription()
      .then(async () => {
        await restoreMissingImages();
        await registerPushToken();
        await recallSyncOnLaunch();
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const reminderId = extractReminderId(response);
        navigateToReminders(router, reminderId);
      }
    );
    return () => sub.remove();
  }, [router]);

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="login"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
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
        pathname: "/(tabs)/(reminders)",
        params: { highlight: reminderId },
      });
    } else {
      router.push("/(tabs)/(reminders)");
    }
  } catch {
    /* router may not be ready yet — cold-start effect will retry */
  }
}
