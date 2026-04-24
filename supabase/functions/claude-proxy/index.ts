/**
 * Supabase Edge Function: claude-proxy
 *
 * Proxies Anthropic Messages API requests so the API key stays server-side.
 * Authenticates callers via Supabase Auth, enforces free-tier quotas, logs
 * token usage, and enforces kids-safe mode for minor household members.
 *
 * DEPLOY REMINDER: after modifying this file, run:
 *   supabase functions deploy claude-proxy
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

// Per-user rate limits (requests per window)
const RATE_LIMITS = {
  free:  { perMinute: 5,  perDay: 50 },
  paid:  { perMinute: 30, perDay: 1000 },
} as const;

// Allowed models — client cannot switch to expensive models
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);

// Tool names that count toward the "plan" bucket
const PLAN_TOOLS = new Set([
  "create_repair_plan",
  "analyze_home_item",
  "verify_repair_from_photo",
]);

// CORS headers — scoped to Supabase project URL (mobile apps don't need CORS
// but the Edge Function runtime requires the headers for preflight)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("SUPABASE_URL") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info",
};

// ---------------------------------------------------------------------------
// Kids-safe system prompts (server-enforced, cannot be bypassed by client)
// ---------------------------------------------------------------------------

const KIDS_SAFE_ASK_PROMPT = `You are HandyBot Junior — a friendly, encouraging home-science guide for young learners. You help kids understand how their home works without putting them at risk.

HARD RULES — you must NEVER give step-by-step repair instructions involving:
- Live electrical work (120V+), outlets, breakers, or wiring
- Gas lines, gas appliances, or pilot lights
- Chemicals that can mix dangerously (bleach + ammonia, acids, etc.)
- Ladders above 6 feet or working on roofs
- Power tools beyond a cordless drill (no saws, grinders, etc.)
- Plumbing behind walls or under slabs

When any of these topics come up, respond warmly:
"That one needs a grown-up — can you show this to your parent and I'll walk both of you through it?"

What you CAN do:
- Explain how things work (how does a toilet flush? what does a circuit breaker do?)
- Encourage observation and diagnosis (what do you see? what sounds does it make?)
- Teach safe, hands-on skills: tightening a loose screw, changing a light bulb (not overhead), using a plunger, checking a smoke detector button
- Celebrate curiosity and build confidence

Tone: friendly, patient, uses simple language and real-world analogies.`;

const KIDS_SAFE_CHAT_PROMPT = `You are HandyBot Junior helping a young learner follow along with a home repair project. An adult has already created this repair plan — your job is to explain what's happening in kid-friendly terms and keep them safe.

HARD RULES — NEVER instruct the minor to:
- Touch electrical panels, outlets, or wires
- Handle gas valves or gas appliances
- Use chemicals, solvents, or adhesives beyond basic soap/water
- Climb ladders above 6 feet or get on the roof
- Operate power tools (saws, grinders, nail guns, etc.)
- Work on plumbing behind walls

If they ask about doing any of these, say:
"That step is for the grown-up — you can watch and learn, but let them handle it!"

You CAN:
- Explain what each step does and why
- Point out cool details in photos
- Suggest safe helper tasks (hand tools to the adult, hold the flashlight, etc.)
- Celebrate their interest in learning`;

const HAZARD_CLASSIFIER_TOOL = {
  name: "classify_hazard",
  description: "Classify whether the conversation involves a physical hazard category.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["electrical", "gas", "heights", "chemical", "safe"],
        description: "The primary hazard category, or 'safe' if none.",
      },
    },
    required: ["category"],
  },
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

/**
 * Extract the user's question text from the messages array.
 */
function extractQuestionText(body: Record<string, unknown>): string {
  const messages = body.messages as Array<{
    role?: string;
    content?: unknown;
  }> | undefined;
  if (!Array.isArray(messages)) return "";
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find(
        (b: { type?: string }) => b.type === "text"
      ) as { text?: string } | undefined;
      if (textBlock?.text) return textBlock.text;
    }
  }
  return "";
}

/**
 * Replace or inject the kids-safe system prompt into the request body.
 * Determines which prompt to use based on whether tools are present
 * (chat with plan context vs general ask).
 */
function enforceKidsSafePrompt(body: Record<string, unknown>): void {
  const hasTools = Array.isArray(body.tools) && (body.tools as unknown[]).length > 0;
  const safePrompt = hasTools ? KIDS_SAFE_CHAT_PROMPT : KIDS_SAFE_ASK_PROMPT;

  // Replace the system prompt entirely
  body.system = [
    {
      type: "text",
      text: safePrompt,
      cache_control: { type: "ephemeral" },
    },
  ];
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

  // 3b. Per-user rate limiting (per-minute and per-day)
  const rateConfig = tier === "free" ? RATE_LIMITS.free : RATE_LIMITS.paid;

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: minuteCount } = await serviceClient
    .from("usage_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneMinuteAgo);

  if ((minuteCount ?? 0) >= rateConfig.perMinute) {
    return jsonResponse(
      { error: "rate_limited", message: "Too many requests. Please wait a moment and try again." },
      429
    );
  }

  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: dayCount } = await serviceClient
    .from("usage_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneDayAgo);

  if ((dayCount ?? 0) >= rateConfig.perDay) {
    return jsonResponse(
      { error: "rate_limited", message: "You've reached your daily request limit. Try again tomorrow." },
      429
    );
  }

  // 3c. Enforce model allowlist — client cannot switch to expensive models
  if (body.model && !ALLOWED_MODELS.has(body.model as string)) {
    body.model = "claude-haiku-4-5-20251001";
  }

  // 3d. Check if caller is a minor household member
  let isMinor = false;
  let minorParentUserId: string | null = null;

  const { data: memberRow } = await serviceClient
    .from("household_members")
    .select("is_minor, minor_parent_user_id")
    .eq("user_id", user.id)
    .eq("is_minor", true)
    .maybeSingle();

  if (memberRow) {
    isMinor = true;
    minorParentUserId = (memberRow.minor_parent_user_id as string) ?? null;
    // Server-enforce kids-safe system prompt — client cannot bypass
    enforceKidsSafePrompt(body);
  }

  // 4. Cap max_tokens and forward to Anthropic
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

  // 5. Record the action only after a successful call so errors don't burn quota
  if (anthropicRes.ok) {
    serviceClient.from("usage_actions").insert({
      user_id: user.id,
      action,
    }).then(() => {}, () => {});
  }

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

  // 7. If minor, run hazard classifier and notify parent (best-effort)
  if (isMinor && minorParentUserId && anthropicRes.ok) {
    classifyAndNotifyParent({
      serviceClient,
      anthropicKey,
      questionText: extractQuestionText(body),
      responseBody,
      minorUserId: user.id,
      parentUserId: minorParentUserId,
    }).catch(() => {});
  }

  // 8. Return Anthropic's response as-is
  return new Response(responseBody, {
    status: anthropicRes.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
});

// ---------------------------------------------------------------------------
// Hazard classification + parent notification (best-effort, non-blocking)
// ---------------------------------------------------------------------------

async function classifyAndNotifyParent(args: {
  serviceClient: ReturnType<typeof createClient>;
  anthropicKey: string;
  questionText: string;
  responseBody: string;
  minorUserId: string;
  parentUserId: string;
}): Promise<void> {
  const { serviceClient, anthropicKey, questionText, responseBody, minorUserId, parentUserId } = args;

  // Extract the assistant's response text
  let assistantText = "";
  try {
    const parsed = JSON.parse(responseBody);
    if (Array.isArray(parsed.content)) {
      assistantText = parsed.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join(" ");
    }
  } catch {
    return;
  }

  // Run a fast Haiku classifier
  const classifierRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: "Classify whether this Q&A involves a physical hazard. Call the classify_hazard tool.",
      tools: [HAZARD_CLASSIFIER_TOOL],
      tool_choice: { type: "tool", name: "classify_hazard" },
      messages: [
        {
          role: "user",
          content: `Question: ${questionText}\n\nAnswer: ${assistantText.slice(0, 500)}`,
        },
      ],
    }),
  });

  if (!classifierRes.ok) return;

  const classifierData = await classifierRes.json();
  const toolUse = classifierData?.content?.find(
    (b: { type: string; name?: string }) =>
      b.type === "tool_use" && b.name === "classify_hazard"
  );
  if (!toolUse) return;

  const category = (toolUse.input as { category?: string })?.category ?? "safe";
  if (category === "safe") return;

  // Insert parent notification — trigger handles push
  await serviceClient.from("parent_notifications").insert({
    parent_user_id: parentUserId,
    minor_user_id: minorUserId,
    question: questionText.slice(0, 1000),
    response: assistantText.slice(0, 1000),
    category,
  });
}
