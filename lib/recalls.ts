import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getActiveHomeId, storagePrefix } from "./homes";
import { getNotificationPrefsSync } from "./notificationPrefs";
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

export type RecallStatus = "new" | "contacted" | "in_progress" | "resolved";

export const RECALL_STATUS_STEPS: Array<{
  key: RecallStatus;
  label: string;
  description: string;
}> = [
  {
    key: "new",
    label: "Discovered",
    description: "Recall identified — review details and contact the manufacturer",
  },
  {
    key: "contacted",
    label: "Contacted",
    description: "Registered with the manufacturer for the recall remedy",
  },
  {
    key: "in_progress",
    label: "In Progress",
    description: "Waiting for repair, replacement, or refund",
  },
  {
    key: "resolved",
    label: "Resolved",
    description: "Recall remedy completed",
  },
];

export interface RecallTracking {
  status: RecallStatus;
  notes?: string;
  updatedAt: number;
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
  /** True when the match is based on an exact model number. */
  isExactMatch: boolean;
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
 * Normalize a model string for comparison: lowercase, strip common suffixes
 * like /AA, remove dashes and spaces so "RF28R7351SR/AA" and "rf28r7351sr"
 * both become "rf28r7351sr".
 */
function normalizeModel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\/[a-z0-9]{1,3}$/i, "") // strip trailing /AA, /AB etc.
    .replace(/[-\s]/g, "")
    .trim();
}

/**
 * Check if the recall's Description field (where CPSC lists affected model
 * numbers as free text) contains the item's model number.
 *
 * The Description often lists models like:
 *   "Model numbers NE58K9430SS/AA, NE58N9430SG/AA, and NE58R9431SG/AA"
 *
 * We normalize both sides and check for a substring match.
 */
function descriptionContainsModel(
  recallDescription: string,
  itemModel: string
): boolean {
  const normalizedModel = normalizeModel(itemModel);
  if (normalizedModel.length < 3) return false;

  // Normalize the description: lowercase and remove dashes so model
  // numbers like "NE58K-9430SS" still match "NE58K9430SS".
  const normalizedDesc = recallDescription.toLowerCase().replace(/-/g, "");
  return normalizedDesc.includes(normalizedModel);
}

interface MatchResult {
  reason: string;
  isExactMatch: boolean;
}

/**
 * Match a recall against an inventory item. Returns a MatchResult if the
 * recall is relevant, or null if it isn't.
 *
 * Matching tiers (most → least confident):
 * 1. Model number found in recall Description → exact match
 * 2. No model on item → manufacturer + product type keyword → possible match
 *
 * Generic keyword matches (e.g. matching on the word "door") are NOT used
 * because they produce too many false positives.
 */
function isRelevantMatch(recall: CPSCRecall, item: HomeItem): MatchResult | null {
  const recallDesc = recall.Description ?? "";

  // Tier 1: Model number match in the recall Description
  if (item.model && item.model.length >= 3) {
    if (descriptionContainsModel(recallDesc, item.model)) {
      return {
        reason: `Model "${item.model}" found in recall description`,
        isExactMatch: true,
      };
    }
    // If we have a model number but it doesn't match, skip — high confidence
    // that this recall is for a different product from the same manufacturer.
    return null;
  }

  // Tier 2: No model number on item — fall back to manufacturer + product
  // type keyword. This is less precise but still useful for items where the
  // user couldn't capture a model number.
  if (item.make) {
    const makeLower = item.make.toLowerCase();
    const mfgMatch = recall.Manufacturers.some(
      (mfg) =>
        mfg.Name.toLowerCase().includes(makeLower) ||
        makeLower.includes(mfg.Name.toLowerCase())
    );
    if (!mfgMatch) return null;

    // Require the recall to mention the specific product type in its title
    // or description. Use product-type keywords from the item name that are
    // specific enough (5+ chars) to avoid false positives.
    const recallText = `${recall.Title} ${recallDesc}`.toLowerCase();
    const productWords = item.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5 && w !== item.make?.toLowerCase());

    for (const word of productWords) {
      if (recallText.includes(word)) {
        return {
          reason: `Manufacturer "${item.make}" + product "${word}" match — verify this applies to your specific model`,
          isExactMatch: false,
        };
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

  function addIfMatch(recall: CPSCRecall, item: HomeItem): void {
    const dedupeKey = `${recall.RecallID}:${item.id}`;
    if (seenRecallIds.has(dedupeKey)) return;
    const match = isRelevantMatch(recall, item);
    if (match) {
      seenRecallIds.add(dedupeKey);
      alerts.push(recallToAlert(recall, item.id, match.reason, match.isExactMatch));
    }
  }

  // Strategy 1: Items WITH a model number — search RecallDescription
  // directly. This is the most precise: the CPSC Description field is
  // where affected model numbers are listed.
  const withModel = items.filter((i) => i.model && i.model.length >= 3);
  for (const item of withModel) {
    try {
      const recalls = await queryCPSC({
        RecallDescription: item.model!,
      });
      for (const recall of recalls) {
        addIfMatch(recall, item);
      }
    } catch {
      /* best-effort */
    }
  }

  // Strategy 2: Items with a make but NO model number — query by
  // manufacturer and rely on product-type keyword matching.
  const makeNoModel = items.filter(
    (i) => i.make && (!i.model || i.model.length < 3)
  );
  const byMake = new Map<string, HomeItem[]>();
  for (const item of makeNoModel) {
    const key = item.make!.toLowerCase().trim();
    const list = byMake.get(key) ?? [];
    list.push(item);
    byMake.set(key, list);
  }

  for (const [make, makeItems] of byMake) {
    try {
      const recalls = await queryCPSC({ Manufacturer: make });
      for (const recall of recalls) {
        for (const item of makeItems) {
          addIfMatch(recall, item);
        }
      }
    } catch (err) {
      console.warn(`Recall check failed for manufacturer "${make}"`, err);
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

  // Respect notification preferences
  const prefs = getNotificationPrefsSync();
  if (!prefs.recallsConfirmed && !prefs.recallsPossible) return;

  // Check existing permission silently — don't prompt
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const notified = await loadNotifiedIds();
  const newAlerts = alerts.filter((a) => {
    if (notified.has(`${a.recallId}:${a.itemId}`)) return false;
    // Filter based on confirmed vs possible preference
    if (a.isExactMatch && !prefs.recallsConfirmed) return false;
    if (!a.isExactMatch && !prefs.recallsPossible) return false;
    return true;
  });

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
      isExactMatch: (row.is_exact_match as boolean) ?? false,
    }));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Recall status tracking
// ---------------------------------------------------------------------------

function trackingKey(): string {
  return storagePrefix() + "recall_tracking";
}

/** Load all recall tracking statuses. */
export async function loadRecallTracking(): Promise<
  Map<string, RecallTracking>
> {
  try {
    const raw = await AsyncStorage.getItem(trackingKey());
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, RecallTracking>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function trackingId(recallId: number, itemId: string): string {
  return `${recallId}:${itemId}`;
}

/** Update the status of a specific recall. */
export async function updateRecallStatus(
  recallId: number,
  itemId: string,
  status: RecallStatus,
  notes?: string
): Promise<void> {
  const map = await loadRecallTracking();
  const id = trackingId(recallId, itemId);
  const existing = map.get(id);
  map.set(id, {
    status,
    notes: notes ?? existing?.notes,
    updatedAt: Date.now(),
  });
  const obj: Record<string, RecallTracking> = {};
  for (const [k, v] of map) obj[k] = v;
  await AsyncStorage.setItem(trackingKey(), JSON.stringify(obj));
}

/** Get the tracking status for a specific recall. */
export function getRecallTracking(
  trackingMap: Map<string, RecallTracking>,
  recallId: number,
  itemId: string
): RecallTracking {
  return (
    trackingMap.get(trackingId(recallId, itemId)) ?? {
      status: "new",
      updatedAt: 0,
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recallToAlert(
  recall: CPSCRecall,
  itemId: string,
  matchReason: string,
  isExactMatch: boolean
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
    isExactMatch,
  };
}
