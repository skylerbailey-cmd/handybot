import { getSession } from "../auth";
import { getSupabase } from "../supabase";
import type { User } from "../types";

/**
 * Upsert the user's profile. This is the anchor row every other table
 * (homes, issues, reminders, etc.) foreign-keys into.
 *
 * If the user has an active Supabase Auth session, we also store the
 * auth UUID so RLS and household queries can resolve it.
 */
export async function pushUser(user: User): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const row: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    created_at: user.createdAt,
  };

  // Attach auth UUID if the user is signed in.
  try {
    const session = await getSession();
    if (session?.user?.id) {
      row.auth_user_id = session.user.id;
    }
  } catch {
    /* ignore — auth link is best-effort */
  }

  const { error } = await supabase
    .from("users")
    .upsert(row, { onConflict: "id" });
  if (error) console.warn("pushUser failed", error.message);
}
