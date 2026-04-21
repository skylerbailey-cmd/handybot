import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveHomeId, loadHomes, storagePrefix } from "../homes";
import { ensureUser } from "../storage";
import { getSupabase } from "../supabase";
import type {
  ChatMessage,
  HomeItem,
  Issue,
  ItemCondition,
  Reminder,
  ReminderCategory,
} from "../types";

/**
 * Progress callback for the restore UI.
 */
export type RestoreStage =
  | "homes"
  | "issues"
  | "reminders"
  | "inventory"
  | "done";

export interface RestoreProgress {
  stage: RestoreStage;
  message: string;
}

/**
 * Pull all user data from Supabase and merge it into local AsyncStorage.
 *
 * Strategy: for each data type, pull from cloud and merge by ID. Cloud rows
 * that don't exist locally are added; rows that exist in both places keep
 * whichever version has the later `updatedAt` / `createdAt` timestamp.
 *
 * Image URIs from the cloud are always https:// URLs, which work on any device.
 * Notification IDs are stripped (device-specific) — reminders will need to be
 * rescheduled locally after restore.
 */
export async function restoreFromCloud(
  onProgress?: (p: RestoreProgress) => void
): Promise<{ itemsRestored: number }> {
  const report = (stage: RestoreStage, message: string) => {
    onProgress?.({ stage, message });
  };

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const user = await ensureUser();
  let totalRestored = 0;

  // 1. Homes
  report("homes", "Restoring homes…");
  totalRestored += await pullAndMergeHomes(user.id);

  // Everything below is scoped to the active home.
  const homeId = getActiveHomeId();

  // 2. Issues (repairs)
  report("issues", "Restoring repairs and photos…");
  totalRestored += await pullAndMergeIssues(user.id, homeId);

  // 3. Reminders
  report("reminders", "Restoring reminders…");
  totalRestored += await pullAndMergeReminders(user.id, homeId);

  // 4. Inventory
  report("inventory", "Restoring home inventory…");
  totalRestored += await pullAndMergeInventory(user.id, homeId);

  report("done", `Restore complete — ${totalRestored} items synced.`);
  return { itemsRestored: totalRestored };
}

// ---------------------------------------------------------------------------
// Homes
// ---------------------------------------------------------------------------

async function pullAndMergeHomes(userId: string): Promise<number> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("homes")
    .select("*")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) return 0;

  const localHomes = await loadHomes();
  const localMap = new Map(localHomes.map((h) => [h.id, h]));
  let added = 0;

  for (const row of data) {
    if (!localMap.has(row.id)) {
      localHomes.push({
        id: row.id,
        name: row.name ?? "Home",
        address: row.address ?? "",
        icon: row.icon ?? "🏠",
        createdAt: row.created_at ?? Date.now(),
      });
      added++;
    }
  }

  if (added > 0) {
    await AsyncStorage.setItem("handybot:homes", JSON.stringify(localHomes));
  }
  return added;
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

async function pullAndMergeIssues(
  userId: string,
  homeId: string
): Promise<number> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("user_id", userId)
    .eq("home_id", homeId);

  if (error || !data || data.length === 0) return 0;

  const key = storagePrefix() + "issues";
  const raw = await AsyncStorage.getItem(key);
  const localIssues: Issue[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(localIssues.map((i) => [i.id, i]));
  let changed = 0;

  for (const row of data) {
    const local = localMap.get(row.id);
    const cloudUpdatedAt = row.updated_at ?? row.created_at ?? 0;

    if (!local || cloudUpdatedAt > local.updatedAt) {
      const messages: ChatMessage[] = Array.isArray(row.messages)
        ? row.messages
        : [];

      const issue: Issue = {
        id: row.id,
        title: row.title ?? "Untitled repair",
        summary: row.summary ?? "",
        status: row.status ?? "in_progress",
        createdAt: row.created_at ?? Date.now(),
        updatedAt: row.updated_at ?? Date.now(),
        coverImageUri: row.cover_image_uri ?? undefined,
        plan: row.plan ?? {
          difficulty: "Medium",
          estimatedMinutes: 0,
          estimatedSavingsUsd: 0,
          tools: [],
          materials: [],
          steps: [],
          safetyNotes: [],
        },
        messages,
      };

      if (local) {
        // Replace the existing entry
        const idx = localIssues.findIndex((i) => i.id === row.id);
        if (idx >= 0) localIssues[idx] = issue;
      } else {
        localIssues.push(issue);
      }
      changed++;
    }
  }

  if (changed > 0) {
    localIssues.sort((a, b) => b.updatedAt - a.updatedAt);
    await AsyncStorage.setItem(key, JSON.stringify(localIssues));
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

async function pullAndMergeReminders(
  userId: string,
  homeId: string
): Promise<number> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("home_id", homeId);

  if (error || !data || data.length === 0) return 0;

  const key = storagePrefix() + "reminders";
  const raw = await AsyncStorage.getItem(key);
  const localReminders: Reminder[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(localReminders.map((r) => [r.id, r]));
  let changed = 0;

  for (const row of data) {
    if (!localMap.has(row.id)) {
      const reminder: Reminder = {
        id: row.id,
        templateId: row.template_id ?? undefined,
        title: row.title ?? "",
        description: row.description ?? undefined,
        icon: row.icon ?? "🔧",
        category: (row.category as ReminderCategory) ?? "general",
        frequencyDays: row.frequency_days ?? 30,
        nextDue: row.next_due ?? Date.now(),
        enabled: row.enabled ?? true,
        // notification_id is device-specific — don't copy it
        notificationId: undefined,
        sourceIssueId: row.source_issue_id ?? undefined,
        createdAt: row.created_at ?? Date.now(),
      };
      localReminders.push(reminder);
      changed++;
    }
  }

  if (changed > 0) {
    await AsyncStorage.setItem(key, JSON.stringify(localReminders));
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

async function pullAndMergeInventory(
  userId: string,
  homeId: string
): Promise<number> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("home_items")
    .select("*")
    .eq("user_id", userId)
    .eq("home_id", homeId);

  if (error || !data || data.length === 0) return 0;

  const key = storagePrefix() + "inventory";
  const raw = await AsyncStorage.getItem(key);
  const localItems: HomeItem[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(localItems.map((i) => [i.id, i]));
  let changed = 0;

  for (const row of data) {
    const local = localMap.get(row.id);
    const cloudUpdatedAt = row.updated_at ?? row.created_at ?? 0;

    if (!local || cloudUpdatedAt > local.updatedAt) {
      const item: HomeItem = {
        id: row.id,
        name: row.name ?? "Unknown item",
        category: row.category ?? "other",
        icon: row.icon ?? "🏠",
        room: row.room ?? "",
        photoUri: row.photo_uri ?? undefined,
        make: row.make ?? undefined,
        model: row.model ?? undefined,
        serialNumber: row.serial_number ?? undefined,
        yearInstalled: row.year_installed ?? undefined,
        estimatedAgeYears: row.estimated_age_years ?? 0,
        typicalLifespanYears: row.typical_lifespan_years ?? 10,
        condition: (row.condition as ItemCondition) ?? "fair",
        conditionNotes: row.condition_notes ?? "",
        maintenanceTips: Array.isArray(row.maintenance_tips)
          ? row.maintenance_tips
          : [],
        suggestedReminders: Array.isArray(row.suggested_reminders)
          ? row.suggested_reminders
          : [],
        createdAt: row.created_at ?? Date.now(),
        updatedAt: row.updated_at ?? Date.now(),
      };

      if (local) {
        const idx = localItems.findIndex((i) => i.id === row.id);
        if (idx >= 0) localItems[idx] = item;
      } else {
        localItems.push(item);
      }
      changed++;
    }
  }

  if (changed > 0) {
    await AsyncStorage.setItem(key, JSON.stringify(localItems));
  }
  return changed;
}
