/**
 * Supabase Edge Function: check-recalls
 *
 * Scheduled to run daily via GitHub Actions (or invoked manually).
 * 1. Fetches recent CPSC recalls (last 3 days for overlap safety)
 * 2. Matches them against all home_items in the database
 * 3. Inserts new recall_alerts rows
 * 4. Sends Expo push notifications to affected users
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CPSCProduct {
  Name: string;
  Description: string;
  Model: string;
  Type: string;
}

interface CPSCRecall {
  RecallID: number;
  RecallNumber: string;
  RecallDate: string;
  Description: string;
  URL: string;
  Title: string;
  Products: CPSCProduct[];
  Images: Array<{ URL: string }>;
  Manufacturers: Array<{ Name: string }>;
  Hazards: Array<{ Name: string }>;
  Remedies: Array<{ Name: string }>;
}

interface HomeItemRow {
  id: string;
  user_id: string;
  home_id: string;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
}

// ---------------------------------------------------------------------------
// CPSC API
// ---------------------------------------------------------------------------

const CPSC_BASE = "https://www.saferproducts.gov/RestWebServices/Recall";

async function fetchRecentRecalls(): Promise<CPSCRecall[]> {
  // Look back 3 days (covers daily cadence with overlap)
  const end = new Date();
  const start = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${CPSC_BASE}?RecallDateStart=${fmt(start)}&RecallDateEnd=${fmt(end)}&format=json`;

  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`CPSC API returned ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const CATEGORY_TERMS: Record<string, string[]> = {
  hvac: ["furnace", "air conditioner", "hvac", "heat pump", "thermostat", "water heater"],
  plumbing: ["faucet", "toilet", "water heater", "pipe", "pump", "valve"],
  electrical: ["outlet", "switch", "panel", "breaker", "wiring", "generator"],
  appliance: ["refrigerator", "dishwasher", "washer", "dryer", "oven", "range", "microwave", "stove"],
  structural: ["door", "window", "deck", "railing"],
  exterior: ["siding", "roof", "gutter", "garage door"],
  safety: ["smoke detector", "carbon monoxide", "fire extinguisher", "alarm"],
};

function matchRecallToItem(
  recall: CPSCRecall,
  item: HomeItemRow
): string | null {
  const itemTerms = [item.name, item.make, item.model]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  // Check recall title and product names
  const recallTexts = [
    recall.Title,
    recall.Description,
    ...recall.Products.map((p) => `${p.Name} ${p.Description} ${p.Model}`),
  ].map((t) => t.toLowerCase());

  for (const term of itemTerms) {
    const words = term.split(/\s+/).filter((w) => w.length >= 3);
    for (const word of words) {
      for (const text of recallTexts) {
        if (text.includes(word)) {
          return `Recall mentions "${word}"`;
        }
      }
    }
  }

  // Check model number exact match
  if (item.model && item.model.length >= 3) {
    const modelLower = item.model.toLowerCase().trim();
    for (const product of recall.Products) {
      if (product.Model.toLowerCase().includes(modelLower)) {
        return `Model "${item.model}" matches recalled product`;
      }
    }
  }

  // Manufacturer + category cross-match
  if (item.make) {
    const makeLower = item.make.toLowerCase();
    const mfgMatch = recall.Manufacturers.some(
      (m) =>
        m.Name.toLowerCase().includes(makeLower) ||
        makeLower.includes(m.Name.toLowerCase())
    );

    if (mfgMatch) {
      const recallText = `${recall.Title} ${recall.Description}`.toLowerCase();
      const terms = [
        ...(CATEGORY_TERMS[item.category] ?? []),
        ...item.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3),
      ];
      for (const ct of terms) {
        if (recallText.includes(ct.toLowerCase())) {
          return `Manufacturer "${item.make}" + "${ct}" match`;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Push notifications via Expo
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  channelId?: string;
}

async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  // Expo accepts batches of up to 100
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      console.error("Push notification batch failed", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    // Allow manual invocation with auth or cron invocation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch recent recalls from CPSC
    console.log("Fetching recent CPSC recalls...");
    const recalls = await fetchRecentRecalls();
    console.log(`Found ${recalls.length} recent recalls`);

    if (recalls.length === 0) {
      await supabase.from("recall_check_log").insert({
        recalls_found: 0,
        alerts_created: 0,
      });
      return new Response(JSON.stringify({ recalls: 0, alerts: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Load all home items from DB
    const { data: allItems, error: itemsErr } = await supabase
      .from("home_items")
      .select("id, user_id, home_id, name, category, make, model");

    if (itemsErr || !allItems) {
      console.error("Failed to load home items", itemsErr?.message);
      return new Response(
        JSON.stringify({ error: "Failed to load inventory" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${recalls.length} recalls against ${allItems.length} items`);

    // 3. Match recalls to items
    const newAlerts: Array<{
      user_id: string;
      home_id: string;
      item_id: string;
      recall_id: number;
      recall_number: string;
      recall_date: string;
      title: string;
      description: string;
      hazard: string;
      remedy: string;
      url: string;
      image_url: string | null;
      match_reason: string;
    }> = [];

    for (const recall of recalls) {
      for (const item of allItems as HomeItemRow[]) {
        const reason = matchRecallToItem(recall, item);
        if (reason) {
          newAlerts.push({
            user_id: item.user_id,
            home_id: item.home_id,
            item_id: item.id,
            recall_id: recall.RecallID,
            recall_number: recall.RecallNumber,
            recall_date: recall.RecallDate,
            title: recall.Title,
            description: recall.Description,
            hazard: recall.Hazards?.[0]?.Name ?? "",
            remedy: recall.Remedies?.[0]?.Name ?? "",
            url: recall.URL,
            image_url: recall.Images?.[0]?.URL ?? null,
            match_reason: reason,
          });
        }
      }
    }

    console.log(`Matched ${newAlerts.length} recall alerts`);

    // 4. Insert alerts (skip duplicates via ON CONFLICT)
    let insertedCount = 0;
    if (newAlerts.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("recall_alerts")
        .upsert(newAlerts, {
          onConflict: "user_id,item_id,recall_id",
          ignoreDuplicates: true,
        })
        .select("id, user_id");

      if (insertErr) {
        console.error("Failed to insert alerts", insertErr.message);
      }
      insertedCount = inserted?.length ?? 0;
    }

    // 5. Send push notifications for new alerts
    if (insertedCount > 0) {
      // Get unique affected user IDs
      const affectedUserIds = [
        ...new Set(newAlerts.map((a) => a.user_id)),
      ];

      // Load push tokens for affected users
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("user_id, token")
        .in("user_id", affectedUserIds);

      if (tokens && tokens.length > 0) {
        // Group alerts by user for notification content
        const alertsByUser = new Map<string, typeof newAlerts>();
        for (const alert of newAlerts) {
          const list = alertsByUser.get(alert.user_id) ?? [];
          list.push(alert);
          alertsByUser.set(alert.user_id, list);
        }

        const messages: ExpoPushMessage[] = [];
        for (const token of tokens) {
          const userAlerts = alertsByUser.get(token.user_id);
          if (!userAlerts || userAlerts.length === 0) continue;

          const count = userAlerts.length;
          messages.push({
            to: token.token,
            title: "Safety Recall Alert",
            body:
              count === 1
                ? `A recall has been issued that may affect your ${userAlerts[0].title.slice(0, 60)}`
                : `${count} recalls found that may affect items in your home inventory`,
            data: { type: "recall_alert" },
            sound: "default",
            channelId: "maintenance",
          });
        }

        await sendPushNotifications(messages);
        console.log(`Sent ${messages.length} push notifications`);

        // Mark alerts as notified
        const alertIds = newAlerts.map((a) => `${a.user_id}:${a.item_id}:${a.recall_id}`);
        // We can't easily get the inserted IDs back, so we mark by composite key
        for (const alert of newAlerts) {
          await supabase
            .from("recall_alerts")
            .update({ notified_at: new Date().toISOString() })
            .eq("user_id", alert.user_id)
            .eq("item_id", alert.item_id)
            .eq("recall_id", alert.recall_id)
            .is("notified_at", null);
        }
      }
    }

    // 6. Log the check
    await supabase.from("recall_check_log").insert({
      recalls_found: recalls.length,
      alerts_created: insertedCount,
    });

    const result = {
      recalls: recalls.length,
      alerts: insertedCount,
    };
    console.log("Done:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-recalls failed", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
