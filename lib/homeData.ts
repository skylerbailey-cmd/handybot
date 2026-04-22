import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { syncInventory } from "./cloud/sync";
import { getActiveHome, storagePrefix } from "./homes";
import { getNotificationPrefsSync } from "./notificationPrefs";
import { ensureNotificationsConfigured, formatFrequency, loadReminders } from "./reminders";
import { generateId, loadIssues } from "./storage";
import { isCloudBackupEnabled } from "./subscription";
import type { AskMessage, HomeItem, Reminder, WarrantyStatus } from "./types";

// --------------------------------------------------------------------------
// Ask HandyBot conversation persistence
// --------------------------------------------------------------------------

function askKey() {
  return storagePrefix() + "ask_messages";
}

export async function loadAskMessages(): Promise<AskMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(askKey());
    if (!raw) return [];
    return JSON.parse(raw) as AskMessage[];
  } catch {
    return [];
  }
}

export async function saveAskMessages(messages: AskMessage[]): Promise<void> {
  await AsyncStorage.setItem(askKey(), JSON.stringify(messages));
}

export async function clearAskMessages(): Promise<void> {
  await AsyncStorage.removeItem(askKey());
}

// --------------------------------------------------------------------------
// Home inventory persistence
// --------------------------------------------------------------------------

function inventoryKey() {
  return storagePrefix() + "inventory";
}

export async function loadInventory(): Promise<HomeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(inventoryKey());
    if (!raw) return [];
    return JSON.parse(raw) as HomeItem[];
  } catch {
    return [];
  }
}

export async function saveInventory(items: HomeItem[]): Promise<void> {
  await AsyncStorage.setItem(inventoryKey(), JSON.stringify(items));

  // Cloud backup (paid tier only). Inventory photos are uploaded and the
  // returned remote URLs are written back into the local cache so we
  // don't re-upload the same file on the next save.
  if (isCloudBackupEnabled()) {
    void syncInventory(items).then(async (normalized) => {
      if (!normalized) return;
      const changed = normalized.some(
        (n, idx) =>
          n.photoUri !== items[idx]?.photoUri ||
          n.warrantyPhotoUri !== items[idx]?.warrantyPhotoUri ||
          n.receiptPhotoUri !== items[idx]?.receiptPhotoUri
      );
      if (changed) {
        try {
          await AsyncStorage.setItem(inventoryKey(), JSON.stringify(normalized));
        } catch {
          /* ignore */
        }
      }
    });
  }
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
 * Compute the warranty status for a single inventory item.
 */
export function getWarrantyStatus(item: HomeItem): WarrantyStatus {
  if (!item.warrantyExpiration) return "none";
  const now = Date.now();
  if (now > item.warrantyExpiration) return "expired";
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (item.warrantyExpiration - now < thirtyDays) return "expiring";
  return "active";
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
    if (getWarrantyStatus(item) === "expiring") return true;
    const remaining = item.typicalLifespanYears - item.estimatedAgeYears;
    return remaining <= 1;
  });
}

// --------------------------------------------------------------------------
// Warranty expiration notifications
// --------------------------------------------------------------------------

const WARRANTY_NOTIFIED_KEY = "handybot:warrantyNotifiedIds";

async function loadWarrantyNotifiedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(
      storagePrefix() + WARRANTY_NOTIFIED_KEY
    );
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveWarrantyNotifiedIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storagePrefix() + WARRANTY_NOTIFIED_KEY,
      JSON.stringify([...ids])
    );
  } catch {
    /* ignore */
  }
}

/**
 * Send a local notification for each item whose warranty is expiring within
 * 30 days, if the user hasn't already been notified. Only fires when the user
 * has already granted permissions and has warranty notifications enabled.
 */
export async function notifyExpiringWarranties(
  items: HomeItem[]
): Promise<void> {
  if (!getNotificationPrefsSync().warranties) return;

  await ensureNotificationsConfigured();
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const expiring = items.filter((i) => getWarrantyStatus(i) === "expiring");
  if (expiring.length === 0) return;

  const notified = await loadWarrantyNotifiedIds();
  const newItems = expiring.filter((i) => !notified.has(i.id));
  if (newItems.length === 0) return;

  for (const item of newItems) {
    const daysLeft = Math.ceil(
      (item.warrantyExpiration! - Date.now()) / (24 * 60 * 60 * 1000)
    );
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.icon} Warranty expiring soon`,
          body: `${item.name} warranty expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. File any claims before it's too late.`,
          data: { type: "warranty", itemId: item.id },
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
    notified.add(item.id);
  }

  await saveWarrantyNotifiedIds(notified);
}

// --------------------------------------------------------------------------
// Home context for Ask HandyBot
// --------------------------------------------------------------------------

/**
 * Builds a text summary of the user's home data (inventory, repairs,
 * reminders) that can be injected into the Ask HandyBot system prompt
 * so Claude can answer questions about the user's specific home.
 */
export async function buildHomeContext(): Promise<string> {
  const [home, inventory, issues, reminders] = await Promise.all([
    getActiveHome(),
    loadInventory(),
    loadIssues(),
    loadReminders(),
  ]);

  const lines: string[] = [];
  lines.push("=== USER'S HOME DATA ===");

  if (home) {
    lines.push(`\nHome: ${home.name}${home.address ? ` (${home.address})` : ""}`);
  }

  // Inventory
  if (inventory.length > 0) {
    lines.push(`\n--- HOME INVENTORY (${inventory.length} items) ---`);
    for (const item of inventory) {
      const parts = [`${item.icon} ${item.name}`];
      if (item.make || item.model)
        parts.push(`Brand/Model: ${[item.make, item.model].filter(Boolean).join(" ")}`);
      if (item.serialNumber) parts.push(`Serial: ${item.serialNumber}`);
      if (item.yearInstalled) parts.push(`Year: ${item.yearInstalled}`);
      parts.push(`Age: ~${item.estimatedAgeYears}yr, Lifespan: ~${item.typicalLifespanYears}yr`);
      parts.push(`Condition: ${item.condition}`);
      if (item.conditionNotes) parts.push(`Notes: ${item.conditionNotes}`);

      const ws = getWarrantyStatus(item);
      if (ws !== "none") {
        const expDate = item.warrantyExpiration
          ? new Date(item.warrantyExpiration).toLocaleDateString()
          : "unknown";
        parts.push(`Warranty: ${ws} (expires ${expDate})`);
        if (item.warrantyProvider) parts.push(`Provider: ${item.warrantyProvider}`);
        if (item.warrantyCoverageNotes)
          parts.push(`Coverage: ${item.warrantyCoverageNotes}`);
      } else if (item.purchaseDate) {
        parts.push(
          `Purchased: ${new Date(item.purchaseDate).toLocaleDateString()}`
        );
      }

      if (item.maintenanceTips.length > 0)
        parts.push(`Tips: ${item.maintenanceTips.join("; ")}`);

      lines.push(`\n• ${parts.join(" | ")}`);
    }
  }

  // Repairs
  const ongoing = issues.filter((i) => i.status === "in_progress");
  const completed = issues.filter(
    (i) => i.status === "completed" || i.status === "verified"
  );

  if (ongoing.length > 0) {
    lines.push(`\n--- ONGOING REPAIRS (${ongoing.length}) ---`);
    for (const issue of ongoing) {
      const stepsDone = issue.plan.steps.filter((s) => s.completed).length;
      lines.push(
        `\n• ${issue.title}: ${issue.summary} | ${issue.plan.difficulty} | ${stepsDone}/${issue.plan.steps.length} steps done`
      );
    }
  }

  if (completed.length > 0) {
    lines.push(`\n--- COMPLETED REPAIRS (${completed.length}) ---`);
    const totalSaved = completed.reduce(
      (s, i) => s + (i.plan.estimatedSavingsUsd ?? 0),
      0
    );
    if (totalSaved > 0) lines.push(`Total saved: $${Math.round(totalSaved)}`);
    for (const issue of completed.slice(0, 20)) {
      const date = new Date(issue.createdAt).toLocaleDateString();
      const saved = issue.plan.estimatedSavingsUsd
        ? ` | Saved ~$${Math.round(issue.plan.estimatedSavingsUsd)}`
        : "";
      lines.push(`\n• ${issue.title} (${date}): ${issue.summary}${saved}`);
    }
    if (completed.length > 20)
      lines.push(`\n... and ${completed.length - 20} more`);
  }

  // Reminders
  const enabledReminders = reminders.filter((r) => r.enabled);
  if (enabledReminders.length > 0) {
    lines.push(`\n--- ACTIVE REMINDERS (${enabledReminders.length}) ---`);
    for (const r of enabledReminders) {
      const due = new Date(r.nextDue).toLocaleDateString();
      lines.push(
        `• ${r.icon} ${r.title}: every ${formatFrequency(r.frequencyDays)}, next due ${due}`
      );
    }
  }

  return lines.join("\n");
}
