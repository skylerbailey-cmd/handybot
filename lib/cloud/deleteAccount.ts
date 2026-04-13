import { getSupabase } from "../supabase";

/**
 * Permanently delete every trace of a user from Supabase:
 *   1. All files in the `photos` bucket under their user_id folder.
 *   2. Their row in `public.users`, which cascades to `homes`, `issues`,
 *      `reminders`, `home_items`, and `enabled_templates` via the foreign
 *      keys defined in the schema.
 *
 * Best-effort: if the storage sweep fails, we still proceed to the DB
 * delete so the user isn't left half-wiped. Any orphan storage objects
 * can be cleaned up by a scheduled job later.
 */
export async function deleteUserCloudData(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // 1. List and delete every object in photos/{userId}/.
  try {
    const { data: files, error: listErr } = await supabase.storage
      .from("photos")
      .list(userId, { limit: 1000 });
    if (!listErr && files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: delErr } = await supabase.storage
        .from("photos")
        .remove(paths);
      if (delErr) console.warn("deleteUserCloudData storage delete failed", delErr.message);
    } else if (listErr) {
      console.warn("deleteUserCloudData storage list failed", listErr.message);
    }
  } catch (err) {
    console.warn("deleteUserCloudData storage threw", err);
  }

  // 2. Delete the user row — ON DELETE CASCADE wipes every child table.
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) {
    console.warn("deleteUserCloudData user delete failed", error.message);
    throw new Error(`Could not delete cloud data: ${error.message}`);
  }
}
