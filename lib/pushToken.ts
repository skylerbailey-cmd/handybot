import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureUser } from "./storage";
import { isCloudBackupEnabled } from "./subscription";
import { getSupabase } from "./supabase";

/**
 * Register the device's Expo push token with Supabase so the server can
 * send push notifications (e.g., recall alerts).
 *
 * Only runs for paid-tier users with cloud backup enabled, since free-tier
 * users don't have data on the server to check against.
 *
 * Safe to call on every app launch — uses upsert by (user_id, token).
 */
export async function registerPushToken(): Promise<void> {
  if (!isCloudBackupEnabled()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Expo push tokens require notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
    if (!tokenData) return;

    const user = await ensureUser();

    await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token: tokenData,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
  } catch (err) {
    console.warn("registerPushToken failed", err);
  }
}
