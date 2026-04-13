import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { syncIssues, syncUser } from "./cloud/sync";
import { storagePrefix } from "./homes";
import { isCloudBackupEnabled } from "./subscription";
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

  // Cloud backup (paid tier only). Pushes rows to Supabase in the
  // background; if any file:// images were uploaded, write the returned
  // https URLs back to the local cache so we don't re-upload next time.
  if (isCloudBackupEnabled()) {
    void syncIssues(issues).then(async (normalized) => {
      if (!normalized) return;
      const changed = normalized.some((n, idx) => {
        const local = issues[idx];
        if (!local) return true;
        if (local.coverImageUri !== n.coverImageUri) return true;
        if (local.messages.length !== n.messages.length) return true;
        for (let i = 0; i < local.messages.length; i++) {
          if (local.messages[i].imageUri !== n.messages[i].imageUri) return true;
        }
        return false;
      });
      if (changed) {
        try {
          await AsyncStorage.setItem(issuesKey(), JSON.stringify(normalized));
        } catch {
          /* ignore */
        }
      }
    });
  }
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
  if (isCloudBackupEnabled()) {
    void syncUser();
  }
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function wipeAllData(): Promise<void> {
  await AsyncStorage.multiRemove([issuesKey(), USER_KEY]);
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
