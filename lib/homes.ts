import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncHomes } from "./cloud/sync";
import { generateId } from "./storage";
import { isCloudBackupEnabled } from "./subscription";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface Home {
  id: string;
  name: string;
  address: string;
  icon: string;
  createdAt: number;
  /** Set when this home is shared with a household. */
  householdId?: string;
}

// --------------------------------------------------------------------------
// Active home (module-level so storage functions can read it without params)
// --------------------------------------------------------------------------

let _activeHomeId: string = "default";

export function getActiveHomeId(): string {
  return _activeHomeId;
}

/**
 * Returns the key prefix all storage functions should use. Every piece
 * of user data is scoped to the active home so switching homes swaps
 * everything at once.
 */
export function storagePrefix(): string {
  return `handybot:${_activeHomeId}:`;
}

// --------------------------------------------------------------------------
// Homes CRUD (persisted in a non-namespaced key so it's always accessible)
// --------------------------------------------------------------------------

const HOMES_KEY = "handybot:homes";
const ACTIVE_HOME_KEY = "handybot:activeHomeId";

export async function loadHomes(): Promise<Home[]> {
  try {
    const raw = await AsyncStorage.getItem(HOMES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Home[];
  } catch {
    return [];
  }
}

async function saveHomes(homes: Home[]): Promise<void> {
  await AsyncStorage.setItem(HOMES_KEY, JSON.stringify(homes));
  if (isCloudBackupEnabled()) {
    void syncHomes(homes);
  }
}

export async function addHome(home: Home): Promise<void> {
  const all = await loadHomes();
  all.push(home);
  await saveHomes(all);
}

export async function removeHome(homeId: string): Promise<void> {
  const all = (await loadHomes()).filter((h) => h.id !== homeId);
  await saveHomes(all);
  // If we just removed the active home, switch to the first remaining
  if (homeId === _activeHomeId && all.length > 0) {
    await switchHome(all[0].id);
  }
}

export async function updateHome(
  homeId: string,
  updates: Partial<Home>
): Promise<void> {
  const all = await loadHomes();
  const idx = all.findIndex((h) => h.id === homeId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    await saveHomes(all);
  }
}

export async function switchHome(homeId: string): Promise<void> {
  _activeHomeId = homeId;
  await AsyncStorage.setItem(ACTIVE_HOME_KEY, homeId);
}

export async function getActiveHome(): Promise<Home | undefined> {
  const all = await loadHomes();
  return all.find((h) => h.id === _activeHomeId);
}

// --------------------------------------------------------------------------
// First-launch migration: create a default home and move any existing
// un-namespaced data into its namespace.
// --------------------------------------------------------------------------

const MIGRATED_KEY = "handybot:migratedToMultiHome";

const LEGACY_KEYS = [
  "handybot:issues",
  "handybot:reminders",
  "handybot:inventory",
  "handybot:ask_messages",
];

export async function ensureMultiHomeSetup(): Promise<void> {
  // Restore persisted active home
  const savedActive = await AsyncStorage.getItem(ACTIVE_HOME_KEY);
  if (savedActive) {
    _activeHomeId = savedActive;
  }

  const homes = await loadHomes();
  if (homes.length > 0) return; // already set up

  // Check if migration already ran
  const migrated = await AsyncStorage.getItem(MIGRATED_KEY);
  if (migrated) return;

  // Create default home
  const defaultHome: Home = {
    id: "default",
    name: "My Home",
    address: "",
    icon: "🏠",
    createdAt: Date.now(),
  };
  await saveHomes([defaultHome]);
  await switchHome("default");

  // Migrate legacy keys → namespaced keys
  for (const legacyKey of LEGACY_KEYS) {
    try {
      const data = await AsyncStorage.getItem(legacyKey);
      if (data) {
        const newKey = legacyKey.replace("handybot:", "handybot:default:");
        await AsyncStorage.setItem(newKey, data);
        await AsyncStorage.removeItem(legacyKey);
      }
    } catch {
      /* best-effort migration */
    }
  }

  await AsyncStorage.setItem(MIGRATED_KEY, "1");
}
