import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logActivity } from "./activityLog";
import { syncReminders } from "./cloud/sync";
import { storagePrefix } from "./homes";
import { generateId } from "./storage";
import { isCloudBackupEnabled } from "./subscription";
import { getNotificationPrefsSync } from "./notificationPrefs";
import type {
  MaintenanceTemplate,
  Reminder,
  ReminderCategory,
  SuggestedReminder,
} from "./types";

function remindersKey() {
  return storagePrefix() + "reminders";
}
const PERMISSIONS_PROMPTED_KEY = "handybot:notifPrompted";

const DAY_MS = 24 * 60 * 60 * 1000;

// --------------------------------------------------------------------------
// Notification setup
// --------------------------------------------------------------------------

let handlerConfigured = false;
let androidChannelConfigured = false;

/**
 * Idempotent one-time setup: display handler, Android notification channel,
 * and permissions prompt. Safe to call from anywhere in the app on mount.
 */
export async function ensureNotificationsConfigured(): Promise<void> {
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // shouldShowAlert was split into banner + list in newer SDKs; we
        // keep shouldShowAlert for back-compat and set both new fields too.
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  if (Platform.OS === "android" && !androidChannelConfigured) {
    try {
      await Notifications.setNotificationChannelAsync("maintenance", {
        name: "Maintenance reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#EA580C",
      });
      androidChannelConfigured = true;
    } catch {
      /* ignore — best effort */
    }
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureNotificationsConfigured();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (
    existing.status === "denied" &&
    existing.canAskAgain === false
  ) {
    return false;
  }
  const result = await Notifications.requestPermissionsAsync();
  try {
    await AsyncStorage.setItem(PERMISSIONS_PROMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
  return result.granted;
}

// --------------------------------------------------------------------------
// Storage
// --------------------------------------------------------------------------

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(remindersKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Reminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveReminders(reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(remindersKey(), JSON.stringify(reminders));
  if (isCloudBackupEnabled()) {
    void syncReminders(reminders);
  }
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  return (await loadReminders()).find((r) => r.id === id);
}

async function upsertReminder(reminder: Reminder): Promise<void> {
  const all = await loadReminders();
  const idx = all.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) all[idx] = reminder;
  else all.unshift(reminder);
  // Sort enabled + soonest first
  all.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.nextDue - b.nextDue;
  });
  await saveReminders(all);
}

// --------------------------------------------------------------------------
// Scheduling
// --------------------------------------------------------------------------

async function scheduleLocalNotification(
  reminder: Reminder
): Promise<string | undefined> {
  const secondsFromNow = Math.max(
    60, // never fire in the past / super-soon: minimum 60s
    Math.round((reminder.nextDue - Date.now()) / 1000)
  );

  // Respect notification preferences
  if (!getNotificationPrefsSync().reminders) return undefined;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${reminder.icon}  ${reminder.title}`,
        body:
          reminder.description ||
          "Time to take care of this home-maintenance task.",
        data: { reminderId: reminder.id },
      },
      // Trigger shape changed between SDK 51 and 52+: newer SDKs require a
      // `type: "timeInterval"` tag. Cast to any so we stay compatible across
      // SDKs without gating on the precise type definitions.
      trigger: {
        type: "timeInterval",
        seconds: secondsFromNow,
        repeats: false,
        channelId: "maintenance",
      } as unknown as Notifications.NotificationTriggerInput,
    });
    return id;
  } catch (err) {
    console.warn("Failed to schedule notification", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

async function cancelLocalNotification(notificationId?: string): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    /* ignore */
  }
}

// --------------------------------------------------------------------------
// High-level API
// --------------------------------------------------------------------------

/**
 * Create a new reminder from one of the prebuilt templates. Schedules a
 * local notification and returns the saved Reminder.
 */
export async function createReminderFromTemplate(
  template: MaintenanceTemplate,
  startDate: Date
): Promise<Reminder> {
  await ensureNotificationsConfigured();
  await requestNotificationPermissions();

  const base: Reminder = {
    id: generateId(),
    templateId: template.id,
    title: template.title,
    description: template.description,
    icon: template.icon,
    category: template.category,
    frequencyDays: template.frequencyDays,
    nextDue: startDate.getTime(),
    enabled: true,
    createdAt: Date.now(),
  };

  const notificationId = await scheduleLocalNotification(base);
  const reminder = { ...base, notificationId };
  await upsertReminder(reminder);
  return reminder;
}

/**
 * Create a new reminder from a Claude-suggested follow-up attached to a
 * completed repair.
 */
export async function createReminderFromSuggestion(args: {
  suggestion: SuggestedReminder;
  category?: ReminderCategory;
  sourceIssueId?: string;
  startDate: Date;
}): Promise<Reminder> {
  await ensureNotificationsConfigured();
  await requestNotificationPermissions();

  const base: Reminder = {
    id: generateId(),
    title: args.suggestion.title,
    description: args.suggestion.description,
    icon: args.suggestion.icon || "🛠",
    category: args.category ?? "general",
    frequencyDays: args.suggestion.frequencyDays,
    nextDue: args.startDate.getTime(),
    enabled: true,
    sourceIssueId: args.sourceIssueId,
    createdAt: Date.now(),
  };
  const notificationId = await scheduleLocalNotification(base);
  const reminder = { ...base, notificationId };
  await upsertReminder(reminder);
  return reminder;
}

/** Toggle a reminder on/off. When turning on, reschedules. */
export async function setReminderEnabled(
  reminderId: string,
  enabled: boolean
): Promise<Reminder | undefined> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return undefined;

  if (!enabled) {
    await cancelLocalNotification(reminder.notificationId);
    const updated: Reminder = {
      ...reminder,
      enabled: false,
      notificationId: undefined,
    };
    await upsertReminder(updated);
    return updated;
  }

  // Re-enabling: if next due is in the past, roll it forward by the
  // frequency until it's in the future.
  let nextDue = reminder.nextDue;
  const now = Date.now();
  if (nextDue <= now) {
    const step = reminder.frequencyDays * DAY_MS;
    while (nextDue <= now) nextDue += step;
  }

  const withSchedule: Reminder = { ...reminder, enabled: true, nextDue };
  const notificationId = await scheduleLocalNotification(withSchedule);
  const updated = { ...withSchedule, notificationId };
  await upsertReminder(updated);
  return updated;
}

/** Reschedule an enabled reminder to a new start date. */
export async function rescheduleReminder(
  reminderId: string,
  newStart: Date
): Promise<Reminder | undefined> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return undefined;
  await cancelLocalNotification(reminder.notificationId);
  const updated: Reminder = { ...reminder, nextDue: newStart.getTime() };
  const notificationId = reminder.enabled
    ? await scheduleLocalNotification(updated)
    : undefined;
  const final = { ...updated, notificationId };
  await upsertReminder(final);
  return final;
}

/** Delete a reminder entirely. Cancels any scheduled notification. */
export async function deleteReminder(reminderId: string): Promise<void> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return;
  await cancelLocalNotification(reminder.notificationId);
  const all = (await loadReminders()).filter((r) => r.id !== reminderId);
  await saveReminders(all);
  try {
    logActivity({ action: "deleted", entityType: "reminder", entityId: reminderId, entityTitle: reminder.title });
  } catch { /* ignore */ }
}

/**
 * Mark a reminder as "handled" right now and reschedule the next occurrence.
 * Called when the user taps "Mark done" on a due reminder.
 */
export async function markReminderDone(
  reminderId: string
): Promise<Reminder | undefined> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return undefined;
  await cancelLocalNotification(reminder.notificationId);
  const nextDue = Date.now() + reminder.frequencyDays * DAY_MS;
  const updated: Reminder = { ...reminder, nextDue };
  const notificationId = reminder.enabled
    ? await scheduleLocalNotification(updated)
    : undefined;
  const final = { ...updated, notificationId };
  await upsertReminder(final);
  try {
    logActivity({ action: "completed", entityType: "reminder", entityId: reminderId, entityTitle: reminder.title });
  } catch { /* ignore */ }
  return final;
}

/**
 * Push a reminder's next-due time forward by a few days without changing
 * its baseline frequency. Used when the user needs a little more time
 * before tackling the task.
 */
export async function snoozeReminder(
  reminderId: string,
  snoozeDays: number = 1
): Promise<Reminder | undefined> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return undefined;
  await cancelLocalNotification(reminder.notificationId);
  const nextDue = Date.now() + snoozeDays * DAY_MS;
  const updated: Reminder = { ...reminder, nextDue };
  const notificationId = reminder.enabled
    ? await scheduleLocalNotification(updated)
    : undefined;
  const final = { ...updated, notificationId };
  await upsertReminder(final);
  return final;
}

/**
 * Create a reminder the user wrote by hand (not from a template or a
 * Claude suggestion). Schedules a local notification and stores it.
 */
export async function createCustomReminder(args: {
  title: string;
  description?: string;
  icon?: string;
  category?: ReminderCategory;
  frequencyDays: number;
  startDate: Date;
  sourceIssueId?: string;
  room?: string;
}): Promise<Reminder> {
  await ensureNotificationsConfigured();
  await requestNotificationPermissions();

  const base: Reminder = {
    id: generateId(),
    title: args.title.trim(),
    description: args.description?.trim() || undefined,
    icon: args.icon?.trim() || "🛠",
    category: args.category ?? "general",
    frequencyDays: args.frequencyDays,
    nextDue: args.startDate.getTime(),
    enabled: true,
    sourceIssueId: args.sourceIssueId,
    room: args.room?.trim() || undefined,
    createdAt: Date.now(),
  };

  const notificationId = await scheduleLocalNotification(base);
  const reminder = { ...base, notificationId };
  await upsertReminder(reminder);
  try {
    logActivity({ action: "created", entityType: "reminder", entityId: reminder.id, entityTitle: reminder.title });
  } catch { /* ignore */ }
  return reminder;
}

/**
 * Apply edits to an existing reminder. Reschedules the notification if
 * any scheduling field changed (frequency, next-due, or enabled flag).
 */
export async function updateReminder(args: {
  reminderId: string;
  title?: string;
  description?: string;
  icon?: string;
  frequencyDays?: number;
  nextDue?: number;
}): Promise<Reminder | undefined> {
  const current = await getReminder(args.reminderId);
  if (!current) return undefined;

  const schedulingChanged =
    (args.frequencyDays !== undefined &&
      args.frequencyDays !== current.frequencyDays) ||
    (args.nextDue !== undefined && args.nextDue !== current.nextDue);

  if (schedulingChanged) {
    await cancelLocalNotification(current.notificationId);
  }

  const updated: Reminder = {
    ...current,
    title: args.title?.trim() ?? current.title,
    description:
      args.description !== undefined
        ? args.description.trim() || undefined
        : current.description,
    icon: args.icon?.trim() || current.icon,
    frequencyDays: args.frequencyDays ?? current.frequencyDays,
    nextDue: args.nextDue ?? current.nextDue,
  };

  const notificationId =
    updated.enabled && schedulingChanged
      ? await scheduleLocalNotification(updated)
      : schedulingChanged
        ? undefined
        : current.notificationId;

  const final = { ...updated, notificationId };
  await upsertReminder(final);
  return final;
}

/**
 * Human-friendly description of when a reminder will fire next.
 */
export function formatDueDate(reminder: Reminder): string {
  const ms = reminder.nextDue - Date.now();
  const days = Math.round(ms / DAY_MS);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 30) return `Due in ${days} days`;
  const months = Math.round(days / 30);
  if (months === 1) return "Due in ~1 month";
  return `Due in ~${months} months`;
}

export function formatFrequency(days: number): string {
  if (days <= 7) return "Weekly";
  if (days <= 14) return "Every 2 weeks";
  if (days <= 31) return "Monthly";
  if (days <= 95) return "Every 3 months";
  if (days <= 190) return "Every 6 months";
  if (days <= 380) return "Yearly";
  return `Every ${Math.round(days / 30)} months`;
}

/**
 * Fires a one-off local notification a few seconds from now so the user
 * (or a developer) can verify permissions + display + deep-linking end to
 * end without waiting for a real reminder to come due. Returns true if
 * the notification was scheduled successfully.
 */
export async function scheduleTestNotification(
  delaySeconds: number = 5
): Promise<boolean> {
  await ensureNotificationsConfigured();
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔔 HandyBot test notification",
        body: "Notifications are working. Tap to open Reminders.",
        // No reminderId → deep link lands on the Reminders screen without
        // highlighting anything specific.
        data: {},
      },
      trigger: {
        type: "timeInterval",
        seconds: Math.max(2, delaySeconds),
        repeats: false,
        channelId: "maintenance",
      } as unknown as Notifications.NotificationTriggerInput,
    });
    return true;
  } catch (err) {
    console.warn("Failed to schedule test notification", err instanceof Error ? err.message : String(err));
    return false;
  }
}
