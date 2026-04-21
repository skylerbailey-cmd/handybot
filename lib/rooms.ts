import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncRooms } from "./cloud/sync";
import { storagePrefix } from "./homes";
import { isCloudBackupEnabled } from "./subscription";

const DEFAULT_ROOMS = [
  "Kitchen",
  "Living Room",
  "Master Bedroom",
  "Bedroom",
  "Bathroom",
  "Basement",
  "Garage",
  "Attic",
  "Laundry Room",
  "Dining Room",
  "Office",
  "Outdoor",
  "Utility Room",
];

function roomsKey(): string {
  return storagePrefix() + "custom_rooms";
}

/**
 * Load the user's custom room labels (merged with defaults).
 * Returns a deduplicated, sorted list.
 */
export async function loadRoomLabels(): Promise<string[]> {
  let custom: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(roomsKey());
    if (raw) custom = JSON.parse(raw) as string[];
  } catch {
    // ignore
  }

  const all = new Set([...DEFAULT_ROOMS, ...custom]);
  return [...all].sort((a, b) => a.localeCompare(b));
}

/**
 * Add a custom room label if it doesn't already exist.
 */
export async function addCustomRoom(label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;

  // Don't store if it's already a default
  const lower = trimmed.toLowerCase();
  if (DEFAULT_ROOMS.some((d) => d.toLowerCase() === lower)) return;

  let custom: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(roomsKey());
    if (raw) custom = JSON.parse(raw) as string[];
  } catch {
    // ignore
  }

  if (custom.some((c) => c.toLowerCase() === lower)) return;

  custom.push(trimmed);
  await AsyncStorage.setItem(roomsKey(), JSON.stringify(custom));

  if (isCloudBackupEnabled()) {
    syncRooms(custom).catch(() => {
      /* non-blocking */
    });
  }
}
