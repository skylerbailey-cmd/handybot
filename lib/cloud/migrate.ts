import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadInventory, saveInventory } from "../homeData";
import { getActiveHomeId, loadHomes } from "../homes";
import { loadRoomLabels } from "../rooms";
import { ensureUser, loadIssues, saveIssues } from "../storage";
import { loadReminders } from "../reminders";
import { pushHomes } from "./homesRemote";
import { pushInventory } from "./inventoryRemote";
import { pushIssues } from "./issuesRemote";
import { pushReminders } from "./remindersRemote";
import { pushRooms } from "./roomsRemote";
import { pushUser } from "./userRemote";

/**
 * Progress callback for the migration UI. Reports the current stage and
 * whether it succeeded; the Settings screen surfaces this to the user.
 */
export type MigrateStage =
  | "user"
  | "homes"
  | "issues"
  | "reminders"
  | "inventory"
  | "rooms"
  | "done";

export interface MigrateProgress {
  stage: MigrateStage;
  message: string;
}

/**
 * One-time backfill: pushes everything currently in local storage up to
 * Supabase. Called when the user turns cloud backup ON for the first time.
 *
 * Safe to re-run: every push uses upsert-by-id. If it fails partway through,
 * the user can toggle it off and on again and we'll resume from scratch;
 * the upserts make that idempotent.
 */
export async function runInitialBackfill(
  onProgress?: (p: MigrateProgress) => void
): Promise<void> {
  const report = (stage: MigrateStage, message: string) => {
    onProgress?.({ stage, message });
  };

  // 1. User profile — all other tables foreign-key to this.
  report("user", "Uploading account…");
  const user = await ensureUser();
  await pushUser(user);

  // 2. Homes.
  report("homes", "Uploading homes…");
  const homes = await loadHomes();
  await pushHomes(user.id, homes);

  // Everything below is scoped to the active home.
  const homeId = getActiveHomeId();

  // 3. Issues (projects / repair history).
  report("issues", "Uploading repairs and photos…");
  const issues = await loadIssues();
  const syncedIssues = await pushIssues({
    userId: user.id,
    homeId,
    issues,
  });
  // Write back remote URLs into the local cache so future saves don't
  // re-upload the same files.
  if (syncedIssues.length > 0) {
    await saveIssues(syncedIssues);
  }

  // 4. Reminders.
  report("reminders", "Uploading reminders…");
  const reminders = await loadReminders();
  await pushReminders({ userId: user.id, homeId, reminders });

  // 5. Home inventory (uploads item photos too).
  report("inventory", "Uploading home inventory…");
  const inventory = await loadInventory();
  const syncedInventory = await pushInventory({
    userId: user.id,
    homeId,
    items: inventory,
  });
  if (syncedInventory.length > 0) {
    await saveInventory(syncedInventory);
  }

  // 6. Custom room labels.
  report("rooms", "Uploading rooms…");
  const rooms = await loadRoomLabels();
  await pushRooms({ userId: user.id, homeId, rooms });

  // Record that backfill has completed so we don't run it again needlessly.
  try {
    await AsyncStorage.setItem("handybot:lastBackfillAt", String(Date.now()));
  } catch {
    /* ignore */
  }

  report("done", "Backup complete!");
}
