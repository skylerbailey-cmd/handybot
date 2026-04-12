import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { loadHomes, storagePrefix } from "./homes";
import type { Issue, User } from "./types";

function issuesKey() {
  return storagePrefix() + "issues";
}
const USER_KEY = "handybot:user"; // User is global, not per-home

export async function loadIssues(): Promise<Issue[]> {
  try {
    const raw = await AsyncStorage.getItem(issuesKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Issue[];
    if (!Array.isArray(parsed)) return [];
    // Normalize legacy "resolved" status → "verified" so old issues
    // show up in the Completed section instead of disappearing.
    return parsed.map((issue) => ({
      ...issue,
      status:
        (issue.status as string) === "resolved" ? "verified" : issue.status,
    }));
  } catch (err) {
    console.error("loadIssues failed", err);
    return [];
  }
}

export async function saveIssues(issues: Issue[]): Promise<void> {
  await AsyncStorage.setItem(issuesKey(), JSON.stringify(issues));
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  const all = await loadIssues();
  return all.find((i) => i.id === id);
}

export async function upsertIssue(issue: Issue): Promise<void> {
  const all = await loadIssues();
  const idx = all.findIndex((i) => i.id === issue.id);
  if (idx >= 0) {
    all[idx] = issue;
    // Keep most-recently-updated at the top.
    all.sort((a, b) => b.updatedAt - a.updatedAt);
  } else {
    all.unshift(issue);
  }
  await saveIssues(all);
}

export async function deleteIssue(id: string): Promise<void> {
  const all = await loadIssues();
  const target = all.find((i) => i.id === id);
  await saveIssues(all.filter((i) => i.id !== id));

  // Best-effort cleanup of any image files associated with this issue.
  if (target) {
    const files: string[] = [];
    if (target.coverImageUri) files.push(target.coverImageUri);
    for (const m of target.messages) {
      if (m.imageUri) files.push(m.imageUri);
    }
    await Promise.all(
      files.map(async (uri) => {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {
          /* ignore */
        }
      })
    );
  }
}

export async function loadUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

/**
 * Permanently erase the account and every piece of data the app has stored
 * on the device. Used by Settings → "Delete account" and required for GDPR
 * / CCPA right-to-deletion compliance.
 *
 * Covers:
 *   • All AsyncStorage keys (user, homes, active home, migration/prompt
 *     flags, and every home-scoped data bucket: issues, reminders,
 *     inventory, ask_messages).
 *   • All scheduled local notifications (cancelled before we drop the data).
 *   • The `handybot/` directory under FileSystem.documentDirectory where
 *     photos live.
 */
export async function wipeAllData(): Promise<void> {
  // 1. Cancel every scheduled local notification so they don't fire
  //    after deletion.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* best effort */
  }

  // 2. Build a comprehensive list of AsyncStorage keys to remove. We iterate
  //    every home so that per-home buckets are all included.
  const homes = await loadHomes().catch(() => []);
  const globalKeys = [
    USER_KEY,
    "handybot:homes",
    "handybot:activeHomeId",
    "handybot:migratedToMultiHome",
    "handybot:notifPrompted",
    // Legacy un-namespaced keys (pre-multi-home migration) — harmless if absent.
    "handybot:issues",
    "handybot:reminders",
    "handybot:inventory",
    "handybot:ask_messages",
  ];
  const perHomeKeys = homes.flatMap((h) => [
    `handybot:${h.id}:issues`,
    `handybot:${h.id}:reminders`,
    `handybot:${h.id}:inventory`,
    `handybot:${h.id}:ask_messages`,
  ]);

  // Belt-and-suspenders: also scan AsyncStorage for any other handybot: keys
  // that may exist (e.g. orphaned homes that were removed from the homes list
  // but whose per-home data lingered).
  let allKeys: readonly string[] = [];
  try {
    allKeys = await AsyncStorage.getAllKeys();
  } catch {
    /* ignore */
  }
  const orphanHandybotKeys = allKeys.filter((k) => k.startsWith("handybot:"));

  const toRemove = Array.from(
    new Set([...globalKeys, ...perHomeKeys, ...orphanHandybotKeys])
  );

  try {
    await AsyncStorage.multiRemove(toRemove);
  } catch {
    /* best effort */
  }

  // 3. Delete every image on disk.
  const dir = `${FileSystem.documentDirectory}handybot/`;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    /* ignore */
  }
}

function generateId(): string {
  // Random ID — React Native doesn't always have `crypto.randomUUID`.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureUser(): Promise<User> {
  let user = await loadUser();
  if (!user) {
    user = {
      id: generateId(),
      name: "You",
      createdAt: Date.now(),
    };
    await saveUser(user);
  }
  return user;
}

export { generateId };
