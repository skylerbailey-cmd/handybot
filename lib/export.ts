import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { loadHomes } from "./homes";
import { loadUser } from "./storage";

/**
 * Produces a single JSON string containing *every* piece of user data the
 * app has stored on this device. Intended for the Settings → "Export my
 * data" flow and for fulfilling GDPR data-portability requests.
 *
 * The shape is intentionally generic — we include each home's raw data
 * bucket by key so the export stays valid even when we add new entity
 * types in the future.
 */
export async function exportAllDataAsJson(): Promise<string> {
  const payload = await collectExportPayload();
  return JSON.stringify(payload, null, 2);
}

export interface GdprExportPayload {
  schemaVersion: 1;
  exportedAt: string;
  app: { name: "HandyBot"; version: string };
  user: unknown;
  homes: unknown[];
  activeHomeId: string | null;
  data: Record<
    string,
    {
      issues?: unknown;
      reminders?: unknown;
      inventory?: unknown;
      askMessages?: unknown;
    }
  >;
  images: {
    directory: string;
    files: { name: string; size: number | null; modificationTime: number | null }[];
  };
  note: string;
}

async function collectExportPayload(): Promise<GdprExportPayload> {
  const user = await loadUser();
  const homes = await loadHomes();
  const activeHomeId = await AsyncStorage.getItem("handybot:activeHomeId");

  const data: GdprExportPayload["data"] = {};
  for (const home of homes) {
    const prefix = `handybot:${home.id}:`;
    data[home.id] = {
      issues: await readJsonKey(prefix + "issues"),
      reminders: await readJsonKey(prefix + "reminders"),
      inventory: await readJsonKey(prefix + "inventory"),
      askMessages: await readJsonKey(prefix + "ask_messages"),
    };
  }

  // List image files so the user knows what's referenced by URI in the data.
  // We don't inline image bytes — a large JSON blob with base64 photos would
  // be unusable on device. The URIs in the data fields point to these files.
  const imagesDir = `${FileSystem.documentDirectory}handybot/`;
  const imageFiles: GdprExportPayload["images"]["files"] = [];
  try {
    const names = await FileSystem.readDirectoryAsync(imagesDir);
    for (const name of names) {
      try {
        const info = await FileSystem.getInfoAsync(imagesDir + name);
        imageFiles.push({
          name,
          size: info.exists && "size" in info ? (info.size as number) : null,
          modificationTime:
            info.exists && "modificationTime" in info
              ? (info.modificationTime as number)
              : null,
        });
      } catch {
        /* skip */
      }
    }
  } catch {
    /* directory may not exist yet */
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: { name: "HandyBot", version: "0.1" },
    user,
    homes,
    activeHomeId,
    data,
    images: {
      directory: imagesDir,
      files: imageFiles,
    },
    note:
      "Image files referenced by URI in the data fields live on this device " +
      "in the directory listed above. They are not inlined in this JSON " +
      "export to keep the file reasonable in size. Contact support@grnd-lab.com " +
      "if you need the image bytes packaged with your export.",
  };
}

async function readJsonKey(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write the JSON export to a file in the app cache directory and return
 * the URI. Callers typically pass this to `expo-sharing` or `Share.share`.
 */
export async function writeExportToFile(
  json: string
): Promise<{ uri: string; filename: string }> {
  const filename = `handybot-data-export-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json);
  return { uri, filename };
}
