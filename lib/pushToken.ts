import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureUser } from "./storage";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const LAST_TOKEN_KEY = "handybot:lastPushToken";

/**
 * Register the device's Expo push token with Supabase so the server can
 * send push notifications (e.g., recall alerts).
 *
 * Runs for ALL users (not just paid tier) so everyone can receive
 * server-side recall notifications.
 *
 * Handles token rotation: if the token changed since last registration,
 * the old token row is deleted so we don't accumulate dead tokens.
 *
 * Safe to call on every app launch.
 */
export async function registerPushToken(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
    if (!tokenData) return;

    const user = await ensureUser();

    // Check if the token has rotated since last registration
    let previousToken: string | null = null;
    try {
      previousToken = await AsyncStorage.getItem(LAST_TOKEN_KEY);
    } catch {
      /* ignore */
    }

    const tokenRotated = previousToken !== null && previousToken !== tokenData;

    // Upsert the current token
    await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token: tokenData,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    // If the token rotated, delete the stale one
    if (tokenRotated) {
      await supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("token", previousToken!);
    }

    // Also prune any tokens for this user that haven't been refreshed
    // in over 60 days — catches edge cases like backup restores to a
    // different device.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id)
      .lt("updated_at", cutoff.toISOString())
      .neq("token", tokenData);

    // Persist the current token so we can detect future rotation
    try {
      await AsyncStorage.setItem(LAST_TOKEN_KEY, tokenData);
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn("registerPushToken failed", err);
  }
}
