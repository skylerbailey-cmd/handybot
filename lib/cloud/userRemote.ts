import { getSupabase } from "../supabase";
import type { User } from "../types";

/**
 * Upsert the user's profile. This is the anchor row every other table
 * (homes, issues, reminders, etc.) foreign-keys into.
 */
export async function pushUser(user: User): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      name: user.name,
      created_at: user.createdAt,
    },
    { onConflict: "id" }
  );
  if (error) console.warn("pushUser failed", error.message);
}
