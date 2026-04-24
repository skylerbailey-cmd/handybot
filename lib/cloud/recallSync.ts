import { loadInventory } from "../homeData";
import { getActiveHomeId } from "../homes";
import { ensureUser } from "../storage";
import { getSupabase, isSupabaseConfigured } from "../supabase";
import type { HomeItem } from "../types";

/**
 * Sync minimal inventory metadata to Supabase so the server-side daily
 * recall check can match CPSC recalls against ALL users' items — not
 * just paid-tier users with full cloud backup.
 *
 * Only syncs the fields needed for matching: name, category, make, model.
 * No photos, no condition notes, no warranty details. This is a lightweight
 * upsert that runs on every app launch for all users.
 */
export async function syncInventoryForRecalls(
  items: HomeItem[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const user = await ensureUser();
    const homeId = getActiveHomeId();

    if (items.length === 0) {
      // If the user has no items, clean up any stale rows
      await supabase
        .from("home_items")
        .delete()
        .eq("user_id", user.id)
        .eq("home_id", homeId);
      return;
    }

    const rows = items.map((item) => ({
      id: item.id,
      user_id: user.id,
      home_id: homeId,
      name: item.name,
      category: item.category,
      make: item.make ?? null,
      model: item.model ?? null,
    }));

    // Upsert by id — only overwrites the recall-relevant columns.
    // If the paid-tier full sync already wrote richer data for this row,
    // this lighter upsert won't clobber those extra columns because
    // Supabase upsert only touches the columns in the row object.
    await supabase
      .from("home_items")
      .upsert(rows, { onConflict: "id" });

    // Delete items that were removed locally
    const localIds = new Set(items.map((i) => i.id));
    const { data: remoteRows } = await supabase
      .from("home_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("home_id", homeId);

    if (remoteRows) {
      const staleIds = remoteRows
        .map((r: { id: string }) => r.id)
        .filter((id: string) => !localIds.has(id));

      if (staleIds.length > 0) {
        await supabase
          .from("home_items")
          .delete()
          .in("id", staleIds);
      }
    }
  } catch (err) {
    // Non-blocking — recall sync is best-effort
    console.warn("syncInventoryForRecalls failed", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Convenience: load local inventory and sync to Supabase.
 * Called on app launch from _layout.tsx.
 */
export async function recallSyncOnLaunch(): Promise<void> {
  try {
    const items = await loadInventory();
    await syncInventoryForRecalls(items);
  } catch {
    // best-effort
  }
}
