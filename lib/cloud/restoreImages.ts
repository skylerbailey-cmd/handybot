import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { getActiveHomeId, storagePrefix } from "../homes";
import { ensureUser } from "../storage";
import { isCloudBackupEnabled } from "../subscription";
import { getSupabase } from "../supabase";
import type { HomeItem, Issue } from "../types";

/**
 * Check whether a local file:// URI still exists on disk.
 */
export async function localFileExists(uri: string): Promise<boolean> {
  if (!uri || !uri.startsWith("file://")) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Scan inventory and issues for broken file:// image URIs (files that no
 * longer exist on disk — typically after an app rebuild or Expo SDK upgrade).
 *
 * If cloud backup is enabled, attempt to restore the https:// URLs from
 * Supabase. If cloud backup is not available, clear the broken URIs so the
 * UI shows a proper placeholder instead of a blank image.
 *
 * Should be called once during app startup.
 */
export async function restoreMissingImages(): Promise<void> {
  const [inventoryFixed, issuesFixed] = await Promise.all([
    fixInventoryImages(),
    fixIssueImages(),
  ]);

  if (inventoryFixed || issuesFixed) {
    console.log(
      `Image restore: inventory=${inventoryFixed}, issues=${issuesFixed}`
    );
  }
}

async function fixInventoryImages(): Promise<boolean> {
  const key = storagePrefix() + "inventory";
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return false;

  let items: HomeItem[];
  try {
    items = JSON.parse(raw) as HomeItem[];
  } catch {
    return false;
  }

  // Find items with broken local file:// URIs
  const broken = new Map<string, number>(); // id → index
  for (let i = 0; i < items.length; i++) {
    const uri = items[i].photoUri;
    if (uri && uri.startsWith("file://")) {
      const exists = await localFileExists(uri);
      if (!exists) {
        broken.set(items[i].id, i);
      }
    }
  }

  if (broken.size === 0) return false;

  // Try to restore from cloud
  if (isCloudBackupEnabled()) {
    const cloudItems = await pullInventoryPhotos();
    if (cloudItems) {
      for (const [id, idx] of broken) {
        const cloud = cloudItems.get(id);
        if (cloud && cloud.startsWith("http")) {
          items[idx] = { ...items[idx], photoUri: cloud };
          broken.delete(id);
        }
      }
    }
  }

  // Clear any remaining broken URIs so the UI shows a placeholder
  for (const [, idx] of broken) {
    items[idx] = { ...items[idx], photoUri: undefined };
  }

  await AsyncStorage.setItem(key, JSON.stringify(items));
  return true;
}

async function fixIssueImages(): Promise<boolean> {
  const key = storagePrefix() + "issues";
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return false;

  let issues: Issue[];
  try {
    issues = JSON.parse(raw) as Issue[];
  } catch {
    return false;
  }

  let changed = false;

  // Try to get cloud data if available
  let cloudIssues: Map<string, { cover?: string; messages: Map<string, string> }> | null = null;
  if (isCloudBackupEnabled()) {
    cloudIssues = await pullIssuePhotos();
  }

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];

    // Check cover image
    if (issue.coverImageUri && issue.coverImageUri.startsWith("file://")) {
      const exists = await localFileExists(issue.coverImageUri);
      if (!exists) {
        const cloudCover = cloudIssues?.get(issue.id)?.cover;
        issues[i] = {
          ...issue,
          coverImageUri: cloudCover?.startsWith("http") ? cloudCover : undefined,
        };
        issue.coverImageUri = issues[i].coverImageUri;
        changed = true;
      }
    }

    // Check message images
    for (let m = 0; m < issue.messages.length; m++) {
      const msg = issue.messages[m];
      if (msg.imageUri && msg.imageUri.startsWith("file://")) {
        const exists = await localFileExists(msg.imageUri);
        if (!exists) {
          const cloudMsg = cloudIssues?.get(issue.id)?.messages.get(msg.id);
          issues[i].messages[m] = {
            ...msg,
            imageUri: cloudMsg?.startsWith("http") ? cloudMsg : undefined,
          };
          changed = true;
        }
      }
    }

    // Check verification photo
    const vr = issue.plan?.verificationResult;
    if (vr?.photoUri && vr.photoUri.startsWith("file://")) {
      const exists = await localFileExists(vr.photoUri);
      if (!exists) {
        issues[i] = {
          ...issue,
          plan: {
            ...issue.plan,
            verificationResult: { ...vr, photoUri: undefined },
          },
        };
        changed = true;
      }
    }
  }

  if (changed) {
    await AsyncStorage.setItem(key, JSON.stringify(issues));
  }
  return changed;
}

/**
 * Pull inventory photo URLs from Supabase. Returns a map of item ID → photo URL.
 */
async function pullInventoryPhotos(): Promise<Map<string, string> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const user = await ensureUser();
    const homeId = getActiveHomeId();
    const { data, error } = await supabase
      .from("home_items")
      .select("id, photo_uri")
      .eq("user_id", user.id)
      .eq("home_id", homeId);

    if (error || !data) return null;

    const map = new Map<string, string>();
    for (const row of data) {
      if (row.photo_uri) map.set(row.id, row.photo_uri);
    }
    return map;
  } catch {
    return null;
  }
}

/**
 * Pull issue photo URLs from Supabase. Returns a map of issue ID → cover + message images.
 */
async function pullIssuePhotos(): Promise<Map<string, { cover?: string; messages: Map<string, string> }> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const user = await ensureUser();
    const homeId = getActiveHomeId();
    const { data, error } = await supabase
      .from("issues")
      .select("id, cover_image_uri, messages")
      .eq("user_id", user.id)
      .eq("home_id", homeId);

    if (error || !data) return null;

    const map = new Map<string, { cover?: string; messages: Map<string, string> }>();
    for (const row of data) {
      const msgMap = new Map<string, string>();
      if (Array.isArray(row.messages)) {
        for (const m of row.messages) {
          if (m.id && m.imageUri) msgMap.set(m.id, m.imageUri);
        }
      }
      map.set(row.id, { cover: row.cover_image_uri ?? undefined, messages: msgMap });
    }
    return map;
  } catch {
    return null;
  }
}
