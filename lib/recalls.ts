import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getActiveHomeId, storagePrefix } from "./homes";
import {
  ensureNotificationsConfigured,
  requestNotificationPermissions,
} from "./reminders";
import { ensureUser } from "./storage";
import { isCloudBackupEnabled } from "./subscription";
import { getSupabase } from "./supabase";
import type { HomeItem } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CPSCProduct {
  Name: string;
  Description: string;
  Model: string;
  Type: string;
  CategoryID: string;
  NumberOfUnits: string;
}

export interface CPSCRecall {
  RecallID: number;
  RecallNumber: string;
  RecallDate: string;
  Description: string;
  URL: string;
  Title: string;
  ConsumerContact: string;
  LastPublishDate: string;
  Products: CPSCProduct[];
  Images: Array<{ URL: string; Caption: string }>;
  Manufacturers: Array<{ Name: string; CompanyID: string }>;
  Hazards: Array<{ Name: string; HazardType: string; HazardTypeID: string }>;
  Remedies: Array<{ Name: string }>;
  RemedyOptions: Array<{ Option: string }>;
}

/** A recall matched to a specific inventory item. */
export interface RecallAlert {
  recallId: number;
  recallNumber: string;
  recallDate: string;
  title: string;
  description: string;
  hazard: string;
  remedy: string;
  url: string;
  imageUrl?: string;
  /** The inventory item ID this recall matches. */
  itemId: string;
  /** How the match was determined. */
  matchReason: string;
}

// ---------------------------------------------------------------------------
// CPSC API
// ---------------------------------------------------------------------------

const CPSC_BASE = "https://www.saferproducts.gov/RestWebServices/Recall";

/**
 * Query the CPSC recalls API. Returns raw recall records.
 * The API is free, public, and requires no authentication.
 */
async function queryCPSC(params: Record<string, string>): Promise<CPSCRecall[]> {
  const query = new URLSearchParams({ ...params, format: "json" });
  const url = `${CPSC_BASE}?${query}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn(`CPSC API returned ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

/**
 * Category keywords that help narrow CPSC search queries for each
 * inventory category.
 */
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  hvac: ["furnace", "air conditioner", "HVAC", "heat pump", "thermostat", "water heater"],
  plumbing: ["faucet", "toilet", "water heater", "pipe", "pump", "valve"],
  electrical: ["outlet", "switch", "panel", "breaker", "wiring", "generator"],
  appliance: ["refrigerator", "dishwasher", "washer", "dryer", "oven", "range", "microwave", "stove"],
  structural: ["door", "window", "deck", "railing", "stairs"],
  exterior: ["siding", "roof", "gutter", "garage door", "fence"],
  safety: ["smoke detector", "carbon monoxide", "fire extinguisher", "alarm"],
  other: [],
};

/**
 * Check if a recall is potentially relevant to an inventory item by
 * comparing keywords in the recall title/description/products against
 * the item's name, make, and model.
 */
function isRelevantMatch(recall: CPSCRecall, item: HomeItem): string | null {
  const itemTerms = [
    item.name,
    item.make,
    item.model,
  ]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  // Check recall title
  const titleLower = recall.Title.toLowerCase();
  for (const term of itemTerms) {
    // Match on meaningful substrings (at least 3 chars to avoid false positives)
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    for (const word of words) {
      if (titleLower.includes(word)) {
        return `Recall title mentions "${word}"`;
      }
    }
  }

  // Check recall product names and descriptions
  for (const product of recall.Products) {
    const productText = `${product.Name} ${product.Description} ${product.Model}`.toLowerCase();
    for (const term of itemTerms) {
      const words = term.split(/\s+/).filter((w) => w.length >= 3);
      for (const word of words) {
        if (productText.includes(word)) {
          return `Recalled product matches "${word}"`;
        }
      }
    }

    // If the item has a model number, check for exact model match
    if (item.model && item.model.length >= 3) {
      const modelLower = item.model.toLowerCase().trim();
      if (product.Model.toLowerCase().includes(modelLower)) {
        return `Model number "${item.model}" matches recalled product`;
      }
    }
  }

  // Check manufacturer match
  if (item.make) {
    const makeLower = item.make.toLowerCase();
    for (const mfg of recall.Manufacturers) {
      if (mfg.Name.toLowerCase().includes(makeLower) || makeLower.includes(mfg.Name.toLowerCase())) {
        // Manufacturer matches, but need at least one product-type keyword match too
        const recallText = `${recall.Title} ${recall.Description}`.toLowerCase();
        const categoryTerms = CATEGORY_SEARCH_TERMS[item.category] ?? [];
        const nameWords = item.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const allTerms = [...categoryTerms, ...nameWords];

        for (const ct of allTerms) {
          if (recallText.includes(ct.toLowerCase())) {
            return `Manufacturer "${item.make}" + product type "${ct}" match`;
          }
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RecallCache {
  alerts: RecallAlert[];
  fetchedAt: number;
}

function cacheKey(): string {
  return storagePrefix() + "recall_alerts";
}

async function loadCache(): Promise<RecallCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey());
    if (!raw) return null;
    const cache = JSON.parse(raw) as RecallCache;
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
    return cache;
  } catch {
    return null;
  }
}

async function saveCache(alerts: RecallAlert[]): Promise<void> {
  const cache: RecallCache = { alerts, fetchedAt: Date.now() };
  try {
    await AsyncStorage.setItem(cacheKey(), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check inventory items against CPSC recalls.
 *
 * - **Paid tier**: reads from the `recall_alerts` table (populated by the
 *   weekly server-side Edge Function). Results are cached locally for 24h.
 * - **Free tier**: queries the CPSC API directly from the device and does
 *   client-side matching. Also cached for 24h.
 */
export async function checkForRecalls(items: HomeItem[]): Promise<RecallAlert[]> {
  // Try cache first
  const cached = await loadCache();
  if (cached) return cached.alerts;

  // Paid tier — read server-side recall alerts
  if (isCloudBackupEnabled()) {
    const cloudAlerts = await loadCloudAlerts();
    if (cloudAlerts) {
      await saveCache(cloudAlerts);
      return cloudAlerts;
    }
    // Fall through to client-side check if cloud read fails
  }

  if (items.length === 0) return [];

  const alerts: RecallAlert[] = [];
  const seenRecallIds = new Set<string>(); // recallId:itemId

  // Group items by manufacturer for efficient querying
  const byMake = new Map<string, HomeItem[]>();
  const noMake: HomeItem[] = [];

  for (const item of items) {
    if (item.make) {
      const key = item.make.toLowerCase().trim();
      const list = byMake.get(key) ?? [];
      list.push(item);
      byMake.set(key, list);
    } else {
      noMake.push(item);
    }
  }

  // Query by manufacturer
  for (const [make, makeItems] of byMake) {
    try {
      const recalls = await queryCPSC({ Manufacturer: make });
      for (const recall of recalls) {
        for (const item of makeItems) {
          const dedupeKey = `${recall.RecallID}:${item.id}`;
          if (seenRecallIds.has(dedupeKey)) continue;

          const reason = isRelevantMatch(recall, item);
          if (reason) {
            seenRecallIds.add(dedupeKey);
            alerts.push(recallToAlert(recall, item.id, reason));
          }
        }
      }
    } catch (err) {
      console.warn(`Recall check failed for manufacturer "${make}"`, err);
    }
  }

  // For items without a make, search by product name keywords
  for (const item of noMake) {
    const searchTerms = item.name
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 2); // limit queries

    for (const term of searchTerms) {
      try {
        const recalls = await queryCPSC({ ProductName: term });
        for (const recall of recalls) {
          const dedupeKey = `${recall.RecallID}:${item.id}`;
          if (seenRecallIds.has(dedupeKey)) continue;

          const reason = isRelevantMatch(recall, item);
          if (reason) {
            seenRecallIds.add(dedupeKey);
            alerts.push(recallToAlert(recall, item.id, reason));
          }
        }
      } catch {
        /* ignore individual failures */
      }
    }
  }

  await saveCache(alerts);

  // Send push notifications for any recalls the user hasn't been notified about
  if (alerts.length > 0) {
    await notifyNewRecalls(alerts, items);
  }

  return alerts;
}

/**
 * Clear the recall cache so the next check fetches fresh data.
 */
export async function clearRecallCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey());
  } catch {
    /* ignore */
  }
}

/**
 * Dismiss a recall alert (paid tier — marks as dismissed in Supabase).
 */
export async function dismissRecallAlert(
  recallId: number,
  itemId: string
): Promise<void> {
  // Remove from local cache
  const cached = await loadCache();
  if (cached) {
    const filtered = cached.alerts.filter(
      (a) => !(a.recallId === recallId && a.itemId === itemId)
    );
    await saveCache(filtered);
  }

  // Mark as dismissed in cloud
  if (isCloudBackupEnabled()) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const user = await ensureUser();
        await supabase
          .from("recall_alerts")
          .update({ dismissed: true })
          .eq("user_id", user.id)
          .eq("item_id", itemId)
          .eq("recall_id", recallId);
      } catch {
        /* best-effort */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Push notifications for new recalls
// ---------------------------------------------------------------------------

function notifiedKey(): string {
  return storagePrefix() + "recall_notified_ids";
}

async function loadNotifiedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(notifiedKey());
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(notifiedKey(), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Send a local push notification for each recall that the user hasn't been
 * notified about yet. Only fires if the user has already granted notification
 * permissions (does NOT prompt — we don't want a surprise permission dialog
 * during a background recall check).
 */
async function notifyNewRecalls(
  alerts: RecallAlert[],
  items: HomeItem[]
): Promise<void> {
  await ensureNotificationsConfigured();

  // Check existing permission silently — don't prompt
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const notified = await loadNotifiedIds();
  const newAlerts = alerts.filter(
    (a) => !notified.has(`${a.recallId}:${a.itemId}`)
  );

  if (newAlerts.length === 0) return;

  const itemMap = new Map(items.map((i) => [i.id, i]));

  for (const alert of newAlerts) {
    const item = itemMap.get(alert.itemId);
    const itemName = item?.name ?? "an item in your inventory";

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠ Safety recall: ${itemName}`,
          body: alert.title || `A CPSC recall may affect ${itemName}. Tap to view details.`,
          data: { type: "recall", itemId: alert.itemId, recallId: alert.recallId },
        },
        trigger: {
          type: "timeInterval",
          seconds: 2,
          repeats: false,
          channelId: "maintenance",
        } as unknown as Notifications.NotificationTriggerInput,
      });
    } catch {
      /* best-effort */
    }

    notified.add(`${alert.recallId}:${alert.itemId}`);
  }

  await saveNotifiedIds(notified);
}

// ---------------------------------------------------------------------------
// Cloud alerts (paid tier)
// ---------------------------------------------------------------------------

/**
 * Read non-dismissed recall alerts from Supabase for the current user/home.
 */
async function loadCloudAlerts(): Promise<RecallAlert[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const user = await ensureUser();
    const homeId = getActiveHomeId();

    const { data, error } = await supabase
      .from("recall_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("home_id", homeId)
      .eq("dismissed", false);

    if (error || !data) return null;

    return data.map((row: Record<string, unknown>) => ({
      recallId: row.recall_id as number,
      recallNumber: (row.recall_number as string) ?? "",
      recallDate: (row.recall_date as string) ?? "",
      title: (row.title as string) ?? "",
      description: (row.description as string) ?? "",
      hazard: (row.hazard as string) ?? "",
      remedy: (row.remedy as string) ?? "",
      url: (row.url as string) ?? "",
      imageUrl: (row.image_url as string) ?? undefined,
      itemId: row.item_id as string,
      matchReason: (row.match_reason as string) ?? "",
    }));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recallToAlert(
  recall: CPSCRecall,
  itemId: string,
  matchReason: string
): RecallAlert {
  return {
    recallId: recall.RecallID,
    recallNumber: recall.RecallNumber,
    recallDate: recall.RecallDate,
    title: recall.Title,
    description: recall.Description,
    hazard: recall.Hazards?.[0]?.Name ?? "",
    remedy: recall.Remedies?.[0]?.Name ?? "",
    url: recall.URL,
    imageUrl: recall.Images?.[0]?.URL,
    itemId,
    matchReason,
  };
}
