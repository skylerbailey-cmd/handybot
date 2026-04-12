import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Subscription / tier gating.
 *
 * Free tier  → all data stays on device (AsyncStorage + file system).
 * Paid tier  → same local cache, plus automatic backup to Supabase so the
 *              user can use the app on multiple devices.
 *
 * For now the "paid" flag is a simple local toggle we flip from Settings so
 * we can develop and test the cloud-sync path end-to-end. When real billing
 * (Stripe / RevenueCat / App Store) is wired up, replace `setCloudBackupEnabled`
 * with a function that reads live entitlement status from the billing
 * provider. Nothing else in the codebase needs to change.
 */

const CLOUD_BACKUP_KEY = "handybot:cloudBackupEnabled";

// In-memory mirror so hot-path code (every save) doesn't have to await
// AsyncStorage on every write.
let _enabled = false;
let _hydrated = false;
const _listeners = new Set<(enabled: boolean) => void>();

export async function hydrateSubscription(): Promise<boolean> {
  if (_hydrated) return _enabled;
  try {
    const raw = await AsyncStorage.getItem(CLOUD_BACKUP_KEY);
    _enabled = raw === "1";
  } catch {
    _enabled = false;
  }
  _hydrated = true;
  return _enabled;
}

/** Synchronous check. Only reliable after hydrateSubscription() has resolved. */
export function isCloudBackupEnabled(): boolean {
  return _enabled;
}

export async function setCloudBackupEnabled(enabled: boolean): Promise<void> {
  _enabled = enabled;
  _hydrated = true;
  try {
    await AsyncStorage.setItem(CLOUD_BACKUP_KEY, enabled ? "1" : "0");
  } catch {
    /* non-fatal */
  }
  for (const fn of _listeners) {
    try {
      fn(enabled);
    } catch {
      /* ignore listener errors */
    }
  }
}

/**
 * Subscribe to paid/free state changes. Returns an unsubscribe function.
 * Used by the Settings screen to re-render when the user toggles backup
 * on/off.
 */
export function subscribeToCloudBackup(
  fn: (enabled: boolean) => void
): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
