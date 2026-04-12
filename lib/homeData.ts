import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "./storage";
import type { AskMessage, HomeItem } from "./types";

// --------------------------------------------------------------------------
// Ask HandyBot conversation persistence
// --------------------------------------------------------------------------

const ASK_KEY = "handybot:ask_messages";

export async function loadAskMessages(): Promise<AskMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(ASK_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AskMessage[];
  } catch {
    return [];
  }
}

export async function saveAskMessages(messages: AskMessage[]): Promise<void> {
  await AsyncStorage.setItem(ASK_KEY, JSON.stringify(messages));
}

export async function clearAskMessages(): Promise<void> {
  await AsyncStorage.removeItem(ASK_KEY);
}

// --------------------------------------------------------------------------
// Home inventory persistence
// --------------------------------------------------------------------------

const INVENTORY_KEY = "handybot:inventory";

export async function loadInventory(): Promise<HomeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HomeItem[];
  } catch {
    return [];
  }
}

export async function saveInventory(items: HomeItem[]): Promise<void> {
  await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
}

export async function addHomeItem(item: HomeItem): Promise<void> {
  const all = await loadInventory();
  all.unshift(item);
  await saveInventory(all);
}

export async function removeHomeItem(itemId: string): Promise<void> {
  const all = (await loadInventory()).filter((i) => i.id !== itemId);
  await saveInventory(all);
}

export async function updateHomeItem(
  itemId: string,
  updates: Partial<HomeItem>
): Promise<HomeItem | undefined> {
  const all = await loadInventory();
  const idx = all.findIndex((i) => i.id === itemId);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...updates, updatedAt: Date.now() };
  await saveInventory(all);
  return all[idx];
}

/**
 * Returns items that are near or past their expected lifespan so the
 * home screen can surface proactive alerts.
 */
export function getItemsNeedingAttention(items: HomeItem[]): HomeItem[] {
  return items.filter((item) => {
    if (item.condition === "replace_soon" || item.condition === "poor") {
      return true;
    }
    const remaining = item.typicalLifespanYears - item.estimatedAgeYears;
    return remaining <= 1;
  });
}
