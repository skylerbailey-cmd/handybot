import { getSupabase } from "../supabase";

/**
 * Push custom room labels for a user+home to Supabase.
 * Replaces the existing set each time (small payload, simple strategy).
 */
export async function pushRooms(args: {
  userId: string;
  homeId: string;
  rooms: string[];
}): Promise<void> {
  const { userId, homeId, rooms } = args;
  const supabase = getSupabase();
  if (!supabase) return;

  // Delete existing rows for this home, then insert fresh.
  const { error: delErr } = await supabase
    .from("custom_rooms")
    .delete()
    .eq("user_id", userId)
    .eq("home_id", homeId);
  if (delErr) {
    console.warn("pushRooms delete failed", delErr.message);
    return;
  }

  if (rooms.length === 0) return;

  const rows = rooms.map((label) => ({
    user_id: userId,
    home_id: homeId,
    label,
  }));
  const { error } = await supabase.from("custom_rooms").insert(rows);
  if (error) console.warn("pushRooms insert failed", error.message);
}

/**
 * Pull custom room labels from Supabase for a user+home.
 */
export async function pullRooms(args: {
  userId: string;
  homeId: string;
}): Promise<string[]> {
  const { userId, homeId } = args;
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("custom_rooms")
    .select("label")
    .eq("user_id", userId)
    .eq("home_id", homeId);
  if (error) {
    console.warn("pullRooms failed", error.message);
    return [];
  }

  return (data ?? []).map((r: { label: string }) => r.label);
}
