/**
 * Supabase Edge Function: claude-proxy
 *
 * Proxies Anthropic Messages API requests so the API key stays server-side.
 * Authenticates callers via Supabase Auth, enforces free-tier quotas, and
 * logs token usage for cost tracking.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS_CAP = 4000;

// Free-tier monthly quotas
const FREE_PLAN_LIMIT = 3; // plans per month
const FREE_ASK_LIMIT = 10; // ask messages per month

// Tool names that count toward the "plan" bucket
const PLAN_TOOLS = new Set([
  "create_repair_plan",
  "analyze_home_item",
  "verify_repair_from_photo",
]);

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Determine the action bucket from the request body's tools array.
 */
function classifyAction(
  body: Record<string, unknown>
): "plan" | "ask" {
  const tools = body.tools as Array<{ name?: string }> | undefined;
  if (!Array.isArray(tools)) return "ask";
  for (const tool of tools) {
    if (tool.name && PLAN_TOOLS.has(tool.name)) return "plan";
  }
  return "ask";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      500
    );
  }

  // 1. Authenticate the caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse(
      { error: "Unauthorized. Sign in to use HandyBot." },
      401
    );
  }

  // 2. Parse the request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  // 3. Determine action bucket and check quota
  const action = classifyAction(body);
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Look up tier (default 'free' if no row)
  const { data: entRow } = await serviceClient
    .from("user_entitlements")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();

  const tier = (entRow?.tier as string) ?? "free";

  if (tier === "free") {
    // Count usage this calendar month
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count, error: countErr } = await serviceClient
      .from("usage_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", action)
      .gte("created_at", monthStart.toISOString());

    if (!countErr) {
      const used = count ?? 0;
      const limit = action === "plan" ? FREE_PLAN_LIMIT : FREE_ASK_LIMIT;
      if (used >= limit) {
        return jsonResponse(
          {
            error: "quota_exceeded",
            message:
              action === "plan"
                ? `You've used all ${FREE_PLAN_LIMIT} free repair plans this month. Upgrade to Pro for unlimited plans.`
                : `You've used all ${FREE_ASK_LIMIT} free questions this month. Upgrade to Pro for unlimited access.`,
          },
          429
        );
      }
    }
  }

  // 4. Record the action (before forwarding — so the count is up-to-date
  //    even if the Anthropic call fails)
  await serviceClient.from("usage_actions").insert({
    user_id: user.id,
    action,
  });

  // 5. Cap max_tokens and forward to Anthropic
  if (
    typeof body.max_tokens !== "number" ||
    body.max_tokens > MAX_TOKENS_CAP
  ) {
    body.max_tokens = MAX_TOKENS_CAP;
  }

  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await anthropicRes.text();

  // 6. Log token usage (best-effort, non-blocking)
  if (anthropicRes.ok) {
    try {
      const parsed = JSON.parse(responseBody);
      const usage = parsed?.usage;
      const model = (parsed?.model as string) ?? (body.model as string) ?? "unknown";
      if (usage) {
        // Fire-and-forget — don't await
        serviceClient
          .from("claude_usage")
          .insert({
            user_id: user.id,
            model,
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_read_tokens: usage.cache_read_input_tokens ?? 0,
            cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
          })
          .then(() => {})
          .catch(() => {});
      }
    } catch {
      // Ignore logging failures
    }
  }

  // 7. Return Anthropic's response as-is
  return new Response(responseBody, {
    status: anthropicRes.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
});
