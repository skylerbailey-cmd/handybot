import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { Issue, User } from "./types";

const ISSUES_KEY = "handybot:issues";
const USER_KEY = "handybot:user";

export async function loadIssues(): Promise<Issue[]> {
  try {
    const raw = await AsyncStorage.getItem(ISSUES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Issue[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("loadIssues failed", err);
    return [];
  }
}

export async function saveIssues(issues: Issue[]): Promise<void> {
  await AsyncStorage.setItem(ISSUES_KEY, JSON.stringify(issues));
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

export async function wipeAllData(): Promise<void> {
  await AsyncStorage.multiRemove([ISSUES_KEY, USER_KEY]);
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
