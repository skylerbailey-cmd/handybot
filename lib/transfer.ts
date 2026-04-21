import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import { loadInventory, saveInventory } from "./homeData";
import {
  addHome,
  getActiveHome,
  storagePrefix,
  switchHome,
  type Home,
} from "./homes";
import { loadReminders } from "./reminders";
import { generateId, loadIssues, saveIssues } from "./storage";
import type { HomeItem, Issue, Reminder } from "./types";

// ---------------------------------------------------------------------------
// Bundle format
// ---------------------------------------------------------------------------

interface HandybotBundle {
  version: 1;
  exportedAt: number;
  appVersion: string;
  home: { name: string; address: string; icon: string };
  issues: Issue[];
  inventory: HomeItem[];
  reminders: Reminder[];
  /** Map of photo key → base64 JPEG data. */
  photos: Record<string, string>;
}

export type TransferProgress = { message: string };

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportHomeBundle(
  onProgress?: (p: TransferProgress) => void
): Promise<void> {
  const home = await getActiveHome();
  const homeMeta = home ?? { name: "My Home", address: "", icon: "🏠" };

  onProgress?.({ message: "Loading data..." });
  const [issues, inventory, reminders] = await Promise.all([
    loadIssues(),
    loadInventory(),
    loadReminders(),
  ]);

  // Collect every local photo URI
  onProgress?.({ message: "Gathering photos..." });
  const photoUris = new Set<string>();
  for (const issue of issues) {
    if (issue.coverImageUri?.startsWith("file://"))
      photoUris.add(issue.coverImageUri);
    for (const m of issue.messages) {
      if (m.imageUri?.startsWith("file://")) photoUris.add(m.imageUri);
    }
  }
  for (const item of inventory) {
    if (item.photoUri?.startsWith("file://")) photoUris.add(item.photoUri);
    if (item.warrantyPhotoUri?.startsWith("file://"))
      photoUris.add(item.warrantyPhotoUri);
    if (item.receiptPhotoUri?.startsWith("file://"))
      photoUris.add(item.receiptPhotoUri);
  }

  // Read photos and build the map
  const photos: Record<string, string> = {};
  const uriToKey = new Map<string, string>();
  let photoIdx = 0;
  for (const uri of photoUris) {
    const key = `photo_${String(photoIdx++).padStart(3, "0")}`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        photos[key] = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uriToKey.set(uri, key);
      }
    } catch {
      // Skip photos we can't read
    }
    if (photoIdx % 5 === 0) {
      onProgress?.({ message: `Gathering photos (${photoIdx})...` });
    }
  }

  // Rewrite URIs to keys in cloned data
  onProgress?.({ message: "Preparing bundle..." });
  const rewrite = (uri: string | undefined): string | undefined => {
    if (!uri) return uri;
    const key = uriToKey.get(uri);
    return key ? `bundle://${key}` : uri;
  };

  const exportIssues: Issue[] = issues.map((issue) => ({
    ...issue,
    coverImageUri: rewrite(issue.coverImageUri),
    messages: issue.messages.map((m) => ({
      ...m,
      imageUri: rewrite(m.imageUri),
    })),
  }));

  const exportInventory: HomeItem[] = inventory.map((item) => ({
    ...item,
    photoUri: rewrite(item.photoUri),
    warrantyPhotoUri: rewrite(item.warrantyPhotoUri),
    receiptPhotoUri: rewrite(item.receiptPhotoUri),
  }));

  const exportReminders: Reminder[] = reminders.map((r) => ({
    ...r,
    notificationId: undefined,
  }));

  const bundle: HandybotBundle = {
    version: 1,
    exportedAt: Date.now(),
    appVersion: "0.1",
    home: { name: homeMeta.name, address: homeMeta.address, icon: homeMeta.icon },
    issues: exportIssues,
    inventory: exportInventory,
    reminders: exportReminders,
    photos,
  };

  // Write to cache and share
  onProgress?.({ message: "Creating file..." });
  const filePath = `${FileSystem.cacheDirectory}home-transfer.handybot`;
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(bundle));

  onProgress?.({ message: "Opening share sheet..." });
  await Sharing.shareAsync(filePath, {
    mimeType: "application/json",
    dialogTitle: "Share home data",
    UTI: "public.json",
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importHomeBundle(
  onProgress?: (p: TransferProgress) => void
): Promise<{ itemsImported: number }> {
  onProgress?.({ message: "Picking file..." });
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { itemsImported: 0 };
  }

  const fileUri = result.assets[0].uri;

  onProgress?.({ message: "Reading file..." });
  const raw = await FileSystem.readAsStringAsync(fileUri);

  let bundle: HandybotBundle;
  try {
    bundle = JSON.parse(raw) as HandybotBundle;
  } catch {
    throw new Error(
      "This doesn't look like a valid HandyBot file. Make sure you selected a .handybot file."
    );
  }

  if (!bundle.version || !bundle.issues || !bundle.inventory) {
    throw new Error(
      "This file is missing required data. It may be corrupted or from an incompatible version."
    );
  }

  // Create a new home for the imported data
  onProgress?.({ message: "Creating home..." });
  const newHomeId = generateId();
  const newHome: Home = {
    id: newHomeId,
    name: bundle.home?.name || "Imported Home",
    address: bundle.home?.address || "",
    icon: bundle.home?.icon || "🏠",
    createdAt: Date.now(),
  };
  await addHome(newHome);
  await switchHome(newHomeId);

  // Restore photos to the file system
  onProgress?.({ message: "Restoring photos..." });
  const imagesDir = `${FileSystem.documentDirectory}handybot/`;
  const dirInfo = await FileSystem.getInfoAsync(imagesDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
  }

  const keyToUri = new Map<string, string>();
  const photoKeys = Object.keys(bundle.photos ?? {});
  for (let i = 0; i < photoKeys.length; i++) {
    const key = photoKeys[i];
    const base64 = bundle.photos[key];
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const destUri = `${imagesDir}${fileName}`;
    try {
      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      keyToUri.set(key, destUri);
    } catch {
      // Skip photos we can't write
    }
    if ((i + 1) % 5 === 0) {
      onProgress?.({ message: `Restoring photos (${i + 1}/${photoKeys.length})...` });
    }
  }

  // Rewrite bundle:// URIs back to local file paths
  const restoreUri = (uri: string | undefined): string | undefined => {
    if (!uri?.startsWith("bundle://")) return uri;
    const key = uri.replace("bundle://", "");
    return keyToUri.get(key) ?? undefined;
  };

  const importedIssues: Issue[] = bundle.issues.map((issue) => ({
    ...issue,
    id: generateId(),
    coverImageUri: restoreUri(issue.coverImageUri),
    messages: issue.messages.map((m) => ({
      ...m,
      id: generateId(),
      imageUri: restoreUri(m.imageUri),
    })),
  }));

  const importedInventory: HomeItem[] = bundle.inventory.map((item) => ({
    ...item,
    id: generateId(),
    photoUri: restoreUri(item.photoUri),
    warrantyPhotoUri: restoreUri(item.warrantyPhotoUri),
    receiptPhotoUri: restoreUri(item.receiptPhotoUri),
  }));

  const importedReminders: Reminder[] = bundle.reminders.map((r) => ({
    ...r,
    id: generateId(),
    notificationId: undefined,
    enabled: false, // Don't auto-schedule notifications on import
  }));

  // Save everything under the new home's storage prefix
  onProgress?.({ message: "Saving data..." });
  await saveIssues(importedIssues);
  await saveInventory(importedInventory);
  const remindersKey = storagePrefix() + "reminders";
  await AsyncStorage.setItem(remindersKey, JSON.stringify(importedReminders));

  const total =
    importedIssues.length + importedInventory.length + importedReminders.length;

  onProgress?.({ message: "Done!" });
  return { itemsImported: total };
}

// ---------------------------------------------------------------------------
// Delete all home data
// ---------------------------------------------------------------------------

export async function deleteAllHomeData(
  onProgress?: (p: TransferProgress) => void
): Promise<void> {
  onProgress?.({ message: "Canceling notifications..." });

  // Cancel all scheduled notifications for this home's reminders
  const reminders = await loadReminders();
  for (const r of reminders) {
    if (r.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(r.notificationId);
      } catch {
        // ignore
      }
    }
  }

  // Collect all photo URIs for this home so we only delete what belongs here
  onProgress?.({ message: "Cleaning up photos..." });
  const issues = await loadIssues();
  const inventory = await loadInventory();
  const photoUris = new Set<string>();
  for (const issue of issues) {
    if (issue.coverImageUri?.startsWith("file://"))
      photoUris.add(issue.coverImageUri);
    for (const m of issue.messages) {
      if (m.imageUri?.startsWith("file://")) photoUris.add(m.imageUri);
    }
  }
  for (const item of inventory) {
    if (item.photoUri?.startsWith("file://")) photoUris.add(item.photoUri);
    if (item.warrantyPhotoUri?.startsWith("file://"))
      photoUris.add(item.warrantyPhotoUri);
    if (item.receiptPhotoUri?.startsWith("file://"))
      photoUris.add(item.receiptPhotoUri);
  }

  // Delete photo files
  await Promise.all(
    [...photoUris].map(async (uri) => {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // ignore
      }
    })
  );

  // Remove all AsyncStorage keys for this home
  onProgress?.({ message: "Removing data..." });
  const prefix = storagePrefix();
  const keysToRemove = [
    prefix + "issues",
    prefix + "reminders",
    prefix + "inventory",
    prefix + "ask_messages",
  ];
  await AsyncStorage.multiRemove(keysToRemove);

  onProgress?.({ message: "Done." });
}
