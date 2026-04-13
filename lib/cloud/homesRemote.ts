import { getSupabase } from "../supabase";
import type { Home } from "../homes";

/**
 * Push the full set of homes for a user. We use "upsert all + delete
 * missing" because the local Home list is the source of truth during the
 * free→paid transition and during normal paid operation.
 */
export async function pushHomes(userId: string, homes: Home[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  if (homes.length > 0) {
    const rows = homes.map((h) => ({
      id: h.id,
      user_id: userId,
      name: h.name,
      address: h.address,
      icon: h.icon,
      created_at: h.createdAt,
    }));
    const { error } = await supabase
      .from("homes")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("pushHomes upsert failed", error.message);
      return;
    }
  }

  // Delete any cloud rows that aren't in the local list anymore.
  const ids = homes.map((h) => h.id);
  const { error: delErr } =
    ids.length > 0
      ? await supabase
          .from("homes")
          .delete()
          .eq("user_id", userId)
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
      : await supabase.from("homes").delete().eq("user_id", userId);
  if (delErr) console.warn("pushHomes delete failed", delErr.message);
}

export async function deleteHomeRemote(
  userId: string,
  homeId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("homes")
    .delete()
    .eq("user_id", userId)
    .eq("id", homeId);
  if (error) console.warn("deleteHomeRemote failed", error.message);
}
