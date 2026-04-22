import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getSession, onAuthStateChange } from "@/lib/auth";
import { recallSyncOnLaunch } from "@/lib/cloud/recallSync";
import { clearRecallCache } from "@/lib/recalls";
import { restoreMissingImages } from "@/lib/cloud/restoreImages";
import { ensureMultiHomeSetup } from "@/lib/homes";
import { registerPushToken } from "@/lib/pushToken";
import { loadNotificationPrefs } from "@/lib/notificationPrefs";
import { ensureNotificationsConfigured } from "@/lib/reminders";
import { seedDemoData } from "@/lib/seedData";
import { hydrateSubscription } from "@/lib/subscription";

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const pendingColdStartReminderId = useRef<string | null>(null);
  const handledColdStart = useRef(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Check auth on mount and listen for changes
  useEffect(() => {
    getSession().then((s) => {
      setHasSession(!!s);
      setAuthChecked(true);
    }).catch(() => {
      setAuthChecked(true);
    });

    const unsub = onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => unsub?.();
  }, []);

  // Redirect to login if no session once nav is ready
  useEffect(() => {
    if (!authChecked || !navReady) return;
    if (!hasSession) {
      router.replace("/login");
    }
  }, [authChecked, navReady, hasSession, router]);

  useEffect(() => {
    ensureMultiHomeSetup()
      .then(() => seedDemoData())
      .catch(() => {});
    ensureNotificationsConfigured().catch(() => {});
    // One-time: clear stale recall cache so the tighter matching logic runs fresh.
    clearRecallCache().catch(() => {});
    loadNotificationPrefs().catch(() => {});
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
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="confirm-email"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="forgot-password"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="reset-password"
            options={{ headerShown: false }}
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
