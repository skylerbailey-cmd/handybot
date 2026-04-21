import { getSupabase } from "../supabase";
import type { HomeItem } from "../types";
import { uploadLocalImageIfNeeded } from "./photosRemote";

export async function pushInventory(args: {
  userId: string;
  homeId: string;
  items: HomeItem[];
}): Promise<HomeItem[]> {
  const { userId, homeId, items } = args;
  const supabase = getSupabase();
  if (!supabase) return items;

  // Upload any local photos first (item photo, warranty doc, receipt).
  const normalized: HomeItem[] = [];
  for (const it of items) {
    const remotePhoto = await uploadLocalImageIfNeeded(it.photoUri, userId);
    const remoteWarrantyPhoto = await uploadLocalImageIfNeeded(it.warrantyPhotoUri, userId);
    const remoteReceiptPhoto = await uploadLocalImageIfNeeded(it.receiptPhotoUri, userId);
    normalized.push({
      ...it,
      photoUri: remotePhoto,
      warrantyPhotoUri: remoteWarrantyPhoto,
      receiptPhotoUri: remoteReceiptPhoto,
    });
  }

  if (normalized.length > 0) {
    const rows = normalized.map((i) => ({
      id: i.id,
      user_id: userId,
      home_id: homeId,
      name: i.name,
      category: i.category,
      icon: i.icon,
      room: i.room,
      photo_uri: i.photoUri ?? null,
      estimated_age_years: i.estimatedAgeYears,
      typical_lifespan_years: i.typicalLifespanYears,
      condition: i.condition,
      condition_notes: i.conditionNotes,
      maintenance_tips: i.maintenanceTips,
      suggested_reminders: i.suggestedReminders ?? [],
      make: i.make ?? null,
      model: i.model ?? null,
      serial_number: i.serialNumber ?? null,
      year_installed: i.yearInstalled ?? null,
      purchase_date: i.purchaseDate ?? null,
      warranty_expiration: i.warrantyExpiration ?? null,
      warranty_provider: i.warrantyProvider ?? null,
      warranty_coverage_notes: i.warrantyCoverageNotes ?? null,
      warranty_photo_uri: i.warrantyPhotoUri ?? null,
      receipt_photo_uri: i.receiptPhotoUri ?? null,
      warranty_registered: i.warrantyRegistered ?? false,
      replacement_cost_usd: i.replacementCostUsd ?? null,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    }));
    const { error } = await supabase
      .from("home_items")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("pushInventory upsert failed", error.message);
      return items;
    }
  }

  const ids = normalized.map((i) => i.id);
  const { error: delErr } =
    ids.length > 0
      ? await supabase
          .from("home_items")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId)
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
      : await supabase
          .from("home_items")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId);
  if (delErr) console.warn("pushInventory delete failed", delErr.message);

  return normalized;
}
