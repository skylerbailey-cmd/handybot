import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "handybot:notifPrefs";

export interface NotificationPrefs {
  reminders: boolean;
  recallsConfirmed: boolean;
  recallsPossible: boolean;
  warranties: boolean;
  /** Marketing communications — must default to false (opt-in only). */
  marketing: boolean;
  /** ISO timestamp of when the user opted in/out of marketing. */
  marketingConsentDate: string | null;
}

const DEFAULTS: NotificationPrefs = {
  reminders: true,
  recallsConfirmed: true,
  recallsPossible: true,
  warranties: true,
  marketing: true,
  marketingConsentDate: null,
};

let cached: NotificationPrefs | null = null;

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  if (cached) return { ...cached };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Migrate old single "recalls" toggle → both confirmed + possible
      const hadOldRecalls =
        typeof parsed.recalls === "boolean" &&
        parsed.recallsConfirmed === undefined;
      cached = {
        reminders: typeof parsed.reminders === "boolean" ? parsed.reminders : DEFAULTS.reminders,
        recallsConfirmed: hadOldRecalls
          ? (parsed.recalls as boolean)
          : typeof parsed.recallsConfirmed === "boolean"
            ? parsed.recallsConfirmed
            : DEFAULTS.recallsConfirmed,
        recallsPossible: hadOldRecalls
          ? (parsed.recalls as boolean)
          : typeof parsed.recallsPossible === "boolean"
            ? parsed.recallsPossible
            : DEFAULTS.recallsPossible,
        warranties: typeof parsed.warranties === "boolean" ? parsed.warranties : DEFAULTS.warranties,
        marketing: typeof parsed.marketing === "boolean" ? parsed.marketing : DEFAULTS.marketing,
        marketingConsentDate: typeof parsed.marketingConsentDate === "string" ? parsed.marketingConsentDate : DEFAULTS.marketingConsentDate,
      };
    } else {
      cached = { ...DEFAULTS };
    }
  } catch {
    cached = { ...DEFAULTS };
  }
  return { ...cached };
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs
): Promise<void> {
  cached = { ...prefs };
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

/** Quick synchronous check — returns cached value or default. */
export function getNotificationPrefsSync(): NotificationPrefs {
  return cached ? { ...cached } : { ...DEFAULTS };
}
