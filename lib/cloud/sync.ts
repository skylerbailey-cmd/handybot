import { getActiveHomeId } from "../homes";
import type { Home } from "../homes";
import { ensureUser } from "../storage";
import { isCloudBackupEnabled } from "../subscription";
import type { HomeItem, Issue, Reminder, User } from "../types";
import { pushHomes } from "./homesRemote";
import { pushInventory } from "./inventoryRemote";
import { pushIssues } from "./issuesRemote";
import { pushReminders } from "./remindersRemote";
import { pushRooms } from "./roomsRemote";
import { pushUser } from "./userRemote";

/**
 * Fire-and-forget sync orchestrator.
 *
 * Local AsyncStorage is the always-authoritative source during a session —
 * the app stays fully responsive even if the network is slow or offline.
 * Each save in the existing storage modules finishes locally and then calls
 * one of the `syncX` helpers below. When the user is on the free tier or
 * Supabase isn't configured, these are no-ops.
 *
 * Errors are swallowed (just logged) — a failed cloud sync should never
 * block the user's local operation.
 */

function shouldSync(): boolean {
  return isCloudBackupEnabled();
}

async function withUser(
  fn: (user: User) => Promise<void>
): Promise<void> {
  try {
    const user = await ensureUser();
    // Ensure the profile row exists in the cloud first — foreign keys
    // reference it. This is cheap (one upsert) and idempotent.
    await pushUser(user);
    await fn(user);
  } catch (err) {
    console.warn("cloud sync failed", err);
  }
}

export async function syncUser(): Promise<void> {
  if (!shouldSync()) return;
  await withUser(async () => {
    /* pushUser already called in withUser */
  });
}

export async function syncHomes(homes: Home[]): Promise<void> {
  if (!shouldSync()) return;
  await withUser(async (user) => {
    await pushHomes(user.id, homes);
  });
}

/**
 * Push issues for the currently active home. Returns the normalized list
 * (with any local file:// images replaced by remote URLs) so callers can
 * persist those URLs back into local AsyncStorage and avoid re-uploading
 * the same file on the next sync.
 */
export async function syncIssues(issues: Issue[]): Promise<Issue[] | null> {
  if (!shouldSync()) return null;
  let result: Issue[] | null = null;
  await withUser(async (user) => {
    result = await pushIssues({
      userId: user.id,
      homeId: getActiveHomeId(),
      issues,
    });
  });
  return result;
}

export async function syncReminders(reminders: Reminder[]): Promise<void> {
  if (!shouldSync()) return;
  await withUser(async (user) => {
    await pushReminders({
      userId: user.id,
      homeId: getActiveHomeId(),
      reminders,
    });
  });
}

export async function syncInventory(
  items: HomeItem[]
): Promise<HomeItem[] | null> {
  if (!shouldSync()) return null;
  let result: HomeItem[] | null = null;
  await withUser(async (user) => {
    result = await pushInventory({
      userId: user.id,
      homeId: getActiveHomeId(),
      items,
    });
  });
  return result;
}

export async function syncRooms(rooms: string[]): Promise<void> {
  if (!shouldSync()) return;
  await withUser(async (user) => {
    await pushRooms({
      userId: user.id,
      homeId: getActiveHomeId(),
      rooms,
    });
  });
}
