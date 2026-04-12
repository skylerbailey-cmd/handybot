import { generateId } from "./storage";
import type {
  ChatRequestMessage,
  Difficulty,
  Issue,
  MaterialItem,
  PlanProposal,
  PlanStep,
  RepairPlan,
  RiskAssessment,
  RiskCategory,
  RiskSeverity,
  SuggestedReminder,
  ToolItem,
  VerificationResult,
} from "./types";

const MODEL_SONNET = "claude-sonnet-4-6";
const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

// --------------------------------------------------------------------------
// System prompts
// --------------------------------------------------------------------------

const PLAN_SYSTEM_PROMPT = `You are HandyBot, a friendly and knowledgeable AI handyman that helps everyday homeowners diagnose and fix things around their house.

The user will send you a photo of a problem in their home (plus an optional note). Your job is to produce a complete, actionable repair plan by calling the \`create_repair_plan\` tool.

Guidelines:
- Be concrete and realistic. Assume the user is an average homeowner with basic DIY skills.
- Use common names for tools and materials (e.g. "adjustable wrench", "plumber's tape", "120-grit sandpaper").
- Break the repair into clear, numbered steps the user can check off one at a time.
- Estimate time realistically including setup and cleanup.
- If the work is dangerous, structural, gas, high-voltage, or involves potable water lines you are unsure of, set difficulty to "Call a pro" and keep the steps focused on making the area safe until a professional arrives.
- Always populate safety_notes when electricity, water shutoff, sharp edges, heights, or chemicals are involved.
- Never invent details you cannot see. If you need a closer look, say so in the opening_message and still produce your best-effort plan.
- Provide a realistic estimated_savings_usd reflecting the LABOR cost only that hiring a licensed pro (handyman, plumber, electrician, etc.) would charge at typical US market rates. Do NOT include materials in this number — the user is buying those. Examples of reasonable ranges: swap an outlet or light switch ~$125-200, fix a dripping faucet ~$150-250, patch drywall ~$200-400, replace a running toilet fill valve ~$150-250, unclog a kitchen drain ~$150-300, replace a garbage disposal ~$200-400, minor roof flashing repair ~$300-600. Set to 0 only if the photo does not actually show something that needs fixing.
- Set the \`risk\` field ONLY when the work involves a genuine physical hazard (live electrical, pressurized water lines, gas, working at height, chemicals, structural, fire risk, or sharp tools/materials). Choose the category that matches the primary hazard. Pick severity based on how likely serious harm is if the user makes a mistake: low = minor shock / small leak / scrape, medium = significant property damage or injury potential, high = risk of fire, electrocution, flooding, gas leak, structural collapse, or serious falls. Set call_a_pro_recommended=true when the severity is medium/high AND a licensed pro would substantially reduce the risk. Omit the risk field entirely for purely cosmetic / low-stakes repairs. The user can always proceed either way — this is advisory.
- If the fix has an obvious recurring-maintenance follow-up (changing a filter every few months, flushing a water heater annually, etc.), populate suggested_reminders with 1-3 items the user could enable after the repair is done. Omit the field for one-off fixes where no recurring task makes sense.
- For each step, set critical_warning ONLY when there is one specific, high-stakes mistake a novice commonly makes on that step. The warning must be concrete, imperative, and focused on the single "don't do this or you'll ruin it" error — not general safety advice. Omit this field for routine steps. Good examples: "Turn off the breaker at the main panel first — testing with the switch is not enough", "Don't overtighten the compression nut or you'll crack the pipe — snug plus a quarter turn is enough", "Lift the toilet straight up and keep it level, or you'll snap the closet bolts", "Never pour water on a grease fire — cover the pan with a metal lid instead", "Mark which wire goes where before disconnecting or you'll reverse polarity". Bad examples (too generic, do NOT use): "Be careful", "Wear safety glasses", "Work slowly".

You MUST call the create_repair_plan tool. Do not reply with plain text.`;

const CHAT_SYSTEM_PROMPT = `You are HandyBot, a friendly and knowledgeable AI handyman helping a homeowner work through a specific repair project.

You have an existing repair plan for this project (provided below). The user is checking in with updates, follow-up photos, or questions as they work through the steps.

Guidelines:
- Refer to steps by their number and short title when relevant.
- Acknowledge progress when the user shows you something they've done.
- Adapt your advice to what you can actually see in any new photos.
- Keep messages warm, short, and practical — the user is mid-repair.
- Only flag safety concerns that are specific and actionable.

Do not repeat the full plan back to the user — they can already see it in the app.

You have access to the \`propose_plan_updates\` tool, which lets you suggest *additions* to the plan (new steps, new tools, new materials, new safety notes, or a revised difficulty / time estimate). Call this tool ONLY when the user's new information genuinely changes the plan — for example:
- A follow-up photo reveals damage or a part the original photo didn't show.
- The user reports they tried something that didn't work, and a different approach is now needed.
- A safety concern is now apparent that wasn't visible before.

Do NOT call the tool for minor clarifications, general encouragement, or simple how-to questions. When you do call it, ALWAYS still include a short plain-language chat reply so the user understands what changed.`;

// --------------------------------------------------------------------------
// Tool schema for structured plan generation
// --------------------------------------------------------------------------

const CREATE_PLAN_TOOL = {
  name: "create_repair_plan",
  description:
    "Creates a structured, actionable repair plan for a homeowner based on the photo and description they shared.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A short 3-6 word title for this repair.",
      },
      summary: {
        type: "string",
        description: "A one-sentence plain-English description of the problem.",
      },
      difficulty: {
        type: "string",
        enum: ["Easy", "Medium", "Hard", "Call a pro"],
        description:
          "How difficult this repair is for an average homeowner. Use 'Call a pro' for anything structural, gas-related, high-voltage, or otherwise unsafe for a DIYer.",
      },
      estimated_minutes: {
        type: "integer",
        description:
          "Total realistic time to complete the repair in minutes, including setup and cleanup.",
      },
      estimated_savings_usd: {
        type: "integer",
        description:
          "Realistic LABOR cost in USD that a licensed professional would charge at typical US market rates to do this repair. Does NOT include materials (the user buys their own). Use a single conservative point estimate. Set to 0 only if the image does not show something that needs fixing.",
      },
      tools: {
        type: "array",
        description:
          "Tools the homeowner will need. List the most important tools first.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Common name of the tool.",
            },
            required: {
              type: "boolean",
              description:
                "True if the tool is essential; false if it's a nice-to-have alternative.",
            },
          },
          required: ["name", "required"],
        },
      },
      materials: {
        type: "array",
        description: "Consumable materials or parts the user will need to buy or gather.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Common name of the material or part.",
            },
            quantity: {
              type: "string",
              description:
                "Quantity needed, e.g. '1 tube', '2 ft', 'as needed'.",
            },
            notes: {
              type: "string",
              description:
                "Optional spec, brand, or purchase note. Keep short.",
            },
            estimated_price_usd: {
              type: "number",
              description:
                "Estimated cost in USD for the quantity needed, based on typical US retail prices (Home Depot, Lowe's, Amazon). Use a single realistic point estimate.",
            },
          },
          required: ["name", "quantity", "estimated_price_usd"],
        },
      },
      steps: {
        type: "array",
        description:
          "Ordered, checkable steps. Each step should be a single clear action.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short imperative title, e.g. 'Turn off the water supply'.",
            },
            detail: {
              type: "string",
              description:
                "1-3 sentences explaining how to do this step, in plain language.",
            },
            estimated_minutes: {
              type: "integer",
              description: "Time in minutes for this step.",
            },
            critical_warning: {
              type: "string",
              description:
                "Optional 'don't mess this up' callout: the ONE specific mistake a novice commonly makes on this step that ruins the repair or causes damage/injury. Be concrete and imperative — e.g. 'Don't overtighten the compression nut or you'll crack the pipe'. Omit entirely for routine steps that don't have a clear high-stakes failure mode. Do NOT use for generic safety advice like 'be careful' or 'wear gloves'.",
            },
          },
          required: ["title", "detail", "estimated_minutes"],
        },
      },
      safety_notes: {
        type: "array",
        description:
          "Short, specific safety warnings. Empty array if none apply.",
        items: { type: "string" },
      },
      suggested_reminders: {
        type: "array",
        description:
          "Optional recurring-maintenance reminders that make sense as follow-ups to this specific repair (e.g. 'Change HVAC filter every 3 months'). Include 0-3 items. Omit entirely if no recurring follow-up applies.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short imperative title." },
            description: {
              type: "string",
              description: "1-2 sentence explanation of what to do.",
            },
            frequency_days: {
              type: "integer",
              description:
                "Recurrence period in days (e.g. 30, 90, 180, 365).",
            },
            icon: {
              type: "string",
              description:
                "Single emoji best representing this task (e.g. 🌬 for filters, 🚿 for water heater).",
            },
          },
          required: ["title", "description", "frequency_days"],
        },
      },
      risk: {
        type: "object",
        description:
          "Hazard assessment for this repair. Include ONLY for work with genuine physical risk (live electrical, pressurized water, gas, heights, chemicals, structural, fire, sharps). Omit entirely for cosmetic / low-stakes work.",
        properties: {
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description:
              "Likelihood of serious harm if the user makes a mistake.",
          },
          category: {
            type: "string",
            enum: [
              "electrical",
              "plumbing",
              "gas",
              "structural",
              "height",
              "chemical",
              "fire",
              "sharps",
              "general",
            ],
            description: "Primary hazard type.",
          },
          headline: {
            type: "string",
            description: "3-5 word label like 'Live 120V wiring'.",
          },
          rationale: {
            type: "string",
            description:
              "1-2 plain-language sentences explaining the specific hazard.",
          },
          call_a_pro_recommended: {
            type: "boolean",
            description:
              "True if a licensed pro is strongly recommended for safety. This is advisory — the user can still proceed.",
          },
        },
        required: [
          "severity",
          "category",
          "headline",
          "rationale",
          "call_a_pro_recommended",
        ],
      },
      opening_message: {
        type: "string",
        description:
          "A warm, conversational message to the user summarizing what you see and how you'll approach the fix. 2-4 sentences. This will appear as the first chat message in the repair workspace.",
      },
    },
    required: [
      "title",
      "summary",
      "difficulty",
      "estimated_minutes",
      "estimated_savings_usd",
      "tools",
      "materials",
      "steps",
      "safety_notes",
      "opening_message",
    ],
  },
} as const;

const VERIFY_REPAIR_TOOL = {
  name: "verify_repair_from_photo",
  description:
    "Analyze a photo of the user's completed repair and verify whether it looks correctly done. If there are real issues you can see in the photo, return fix_steps containing the additional work the user must do. Be generous on acceptance for cosmetic / subjective cases — only reject when you see a concrete problem.",
  input_schema: {
    type: "object",
    properties: {
      verified: {
        type: "boolean",
        description:
          "True if the repair looks correctly done based on the photo. False if you can see a specific problem that needs fixing.",
      },
      feedback: {
        type: "string",
        description:
          "1-3 sentences summarizing what you see and why you accepted or rejected the repair. Speak directly to the user, warmly and specifically. Reference what's visible in the photo.",
      },
      fix_steps: {
        type: "array",
        description:
          "If verified is false, return ordered fix-up steps the user must do to correct the problems you see. Omit or leave empty when verified is true.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            estimated_minutes: { type: "integer" },
            critical_warning: {
              type: "string",
              description:
                "Optional 'don't mess this up' callout for this fix-up step. Same rules as create_repair_plan.",
            },
          },
          required: ["title", "detail", "estimated_minutes"],
        },
      },
    },
    required: ["verified", "feedback"],
  },
} as const;

const PROPOSE_UPDATES_TOOL = {
  name: "propose_plan_updates",
  description:
    "Propose additive changes to the current repair plan when new information from the user changes what needs to happen. Only call this when the change is meaningful (new damage, new discovery, wrong approach, new safety concern). All fields are additive — you may only APPEND new steps, tools, materials, and safety notes. Use new_difficulty or new_total_minutes only if the whole-project estimate should change.",
  input_schema: {
    type: "object",
    properties: {
      rationale: {
        type: "string",
        description:
          "One sentence explaining what changed and why the plan needs an update. This is shown to the user verbatim.",
      },
      new_steps: {
        type: "array",
        description: "Additional steps to append to the current plan.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            estimated_minutes: { type: "integer" },
            critical_warning: {
              type: "string",
              description:
                "Optional 'don't mess this up' callout for the ONE specific mistake that ruins this step. Same rules as create_repair_plan.",
            },
          },
          required: ["title", "detail", "estimated_minutes"],
        },
      },
      new_tools: {
        type: "array",
        description: "Additional tools the user will need.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            required: { type: "boolean" },
          },
          required: ["name", "required"],
        },
      },
      new_materials: {
        type: "array",
        description: "Additional materials or parts the user will need.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "string" },
            notes: { type: "string" },
          },
          required: ["name", "quantity"],
        },
      },
      new_safety_notes: {
        type: "array",
        description: "Additional safety warnings to display.",
        items: { type: "string" },
      },
      new_difficulty: {
        type: "string",
        enum: ["Easy", "Medium", "Hard", "Call a pro"],
        description:
          "Include only if the overall difficulty should change based on the new information.",
      },
      new_total_minutes: {
        type: "integer",
        description:
          "Include only if the overall time estimate should change based on the new information.",
      },
      new_total_savings_usd: {
        type: "integer",
        description:
          "Include only if the overall DIY savings estimate should change based on the new scope (labor cost only, same rules as create_repair_plan).",
      },
    },
    required: ["rationale"],
  },
} as const;

// --------------------------------------------------------------------------
// Shared API helpers
// --------------------------------------------------------------------------

type ApiContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    };

interface ApiMessage {
  role: "user" | "assistant";
  content: ApiContentBlock[];
}

function toApiMessages(messages: ChatRequestMessage[]): ApiMessage[] {
  return messages.map((m) => {
    const content: ApiContentBlock[] = [];
    if (m.imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: m.imageMediaType ?? "image/jpeg",
          data: m.imageBase64,
        },
      });
    }
    const text = m.text?.trim() ?? "";
    if (text.length > 0) {
      content.push({ type: "text", text });
    } else if (content.length === 0) {
      content.push({ type: "text", text: "(no message)" });
    }
    return { role: m.role, content };
  });
}

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Missing Anthropic API key. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env and restart the dev server."
    );
  }
  return key;
}

async function callAnthropic(body: Record<string, unknown>): Promise<unknown> {
  const apiKey = getApiKey();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let errMsg = errBody;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) errMsg = parsed.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Claude API error (${res.status}): ${errMsg}`);
  }

  return res.json();
}

// --------------------------------------------------------------------------
// Plan generation (forced tool use)
// --------------------------------------------------------------------------

interface RawPlanInput {
  title: string;
  summary: string;
  difficulty: string;
  estimated_minutes: number;
  estimated_savings_usd: number;
  tools: Array<{ name: string; required: boolean }>;
  materials: Array<{
    name: string;
    quantity: string;
    notes?: string;
    estimated_price_usd?: number;
  }>;
  steps: Array<{
    title: string;
    detail: string;
    estimated_minutes?: number;
    critical_warning?: string;
  }>;
  safety_notes: string[];
  risk?: {
    severity?: string;
    category?: string;
    headline?: string;
    rationale?: string;
    call_a_pro_recommended?: boolean;
  };
  suggested_reminders?: Array<{
    title: string;
    description: string;
    frequency_days: number;
    icon?: string;
  }>;
  opening_message: string;
}

function normalizeSuggestedReminders(
  raw: RawPlanInput["suggested_reminders"]
): SuggestedReminder[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const list = raw
    .map((r) => ({
      title: String(r.title ?? "").trim(),
      description: String(r.description ?? "").trim(),
      frequencyDays: Number(r.frequency_days) || 0,
      icon: String(r.icon ?? "🛠").trim().slice(0, 4) || "🛠",
    }))
    .filter((r) => r.title && r.frequencyDays > 0);
  return list.length > 0 ? list : undefined;
}

function normalizeRisk(raw: RawPlanInput["risk"]): RiskAssessment | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const headline = String(raw.headline ?? "").trim();
  const rationale = String(raw.rationale ?? "").trim();
  if (!headline && !rationale) return undefined;

  const severityOptions: RiskSeverity[] = ["low", "medium", "high"];
  const severity =
    severityOptions.find((s) => s === String(raw.severity ?? "").toLowerCase()) ??
    "medium";

  const categoryOptions: RiskCategory[] = [
    "electrical",
    "plumbing",
    "gas",
    "structural",
    "height",
    "chemical",
    "fire",
    "sharps",
    "general",
  ];
  const category =
    categoryOptions.find(
      (c) => c === String(raw.category ?? "").toLowerCase()
    ) ?? "general";

  return {
    severity,
    category,
    headline: headline || category.charAt(0).toUpperCase() + category.slice(1) + " hazard",
    rationale,
    callAProRecommended: Boolean(raw.call_a_pro_recommended),
  };
}

interface ClaudeResponse {
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; name: string; input: unknown }
  >;
}

export interface GeneratedPlan {
  title: string;
  summary: string;
  openingMessage: string;
  plan: RepairPlan;
}

function normalizeDifficulty(raw: string): Difficulty {
  const allowed: Difficulty[] = ["Easy", "Medium", "Hard", "Call a pro"];
  const hit = allowed.find((d) => d.toLowerCase() === raw.trim().toLowerCase());
  return hit ?? "Medium";
}

function parsePlan(raw: RawPlanInput): GeneratedPlan {
  const tools: ToolItem[] = (raw.tools ?? []).map((t) => ({
    id: generateId(),
    name: String(t.name),
    required: Boolean(t.required),
    have: false,
  }));

  const materials: MaterialItem[] = (raw.materials ?? []).map((m) => ({
    id: generateId(),
    name: String(m.name),
    quantity: String(m.quantity),
    notes: m.notes ? String(m.notes) : undefined,
    estimatedPriceUsd:
      typeof m.estimated_price_usd === "number" && m.estimated_price_usd > 0
        ? Math.round(m.estimated_price_usd * 100) / 100
        : undefined,
    have: false,
  }));

  const steps: PlanStep[] = (raw.steps ?? []).map((s) => ({
    id: generateId(),
    title: String(s.title),
    detail: String(s.detail),
    estimatedMinutes:
      typeof s.estimated_minutes === "number" ? s.estimated_minutes : undefined,
    criticalWarning:
      typeof s.critical_warning === "string" && s.critical_warning.trim().length > 0
        ? s.critical_warning.trim()
        : undefined,
    completed: false,
  }));

  const estimatedSavingsUsd =
    typeof raw.estimated_savings_usd === "number" &&
    raw.estimated_savings_usd >= 0
      ? Math.round(raw.estimated_savings_usd)
      : 0;

  return {
    title: String(raw.title || "New repair").trim(),
    summary: String(raw.summary || "").trim(),
    openingMessage: String(raw.opening_message || "").trim(),
    plan: {
      difficulty: normalizeDifficulty(raw.difficulty),
      estimatedMinutes: Number(raw.estimated_minutes) || 0,
      estimatedSavingsUsd,
      tools,
      materials,
      steps,
      safetyNotes: Array.isArray(raw.safety_notes)
        ? raw.safety_notes.map((s) => String(s)).filter(Boolean)
        : [],
      risk: normalizeRisk(raw.risk),
      suggestedReminders: normalizeSuggestedReminders(raw.suggested_reminders),
    },
  };
}

export async function createRepairPlan(args: {
  note: string;
  imageBase64: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<GeneratedPlan> {
  const userMessage: ChatRequestMessage = {
    role: "user",
    text: args.note.trim() || "Here's what's broken. Please diagnose it and give me a repair plan I can follow.",
    imageBase64: args.imageBase64,
    imageMediaType: args.imageMediaType ?? "image/jpeg",
  };

  // Plan generation uses Sonnet — quality of structured output matters here.
  const data = (await callAnthropic({
    model: MODEL_SONNET,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: PLAN_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [CREATE_PLAN_TOOL],
    tool_choice: { type: "tool", name: "create_repair_plan" },
    messages: toApiMessages([userMessage]),
  })) as ClaudeResponse;

  const toolUse = data.content.find(
    (b): b is { type: "tool_use"; name: string; input: unknown } =>
      b.type === "tool_use" && b.name === "create_repair_plan"
  );
  if (!toolUse) {
    throw new Error("Claude did not return a structured plan. Try again.");
  }
  return parsePlan(toolUse.input as RawPlanInput);
}

// --------------------------------------------------------------------------
// Plan-aware chat (follow-up conversation inside a project)
// --------------------------------------------------------------------------

function formatPlanForContext(plan: RepairPlan): string {
  const lines: string[] = [];
  lines.push(`Difficulty: ${plan.difficulty}`);
  lines.push(`Estimated time: ${plan.estimatedMinutes} minutes`);
  if (plan.estimatedSavingsUsd > 0) {
    lines.push(`Estimated DIY savings vs hiring a pro: $${plan.estimatedSavingsUsd}`);
  }
  if (plan.risk) {
    lines.push(
      `Risk: ${plan.risk.severity} ${plan.risk.category} — ${plan.risk.headline}${plan.risk.callAProRecommended ? " (pro recommended)" : ""}`
    );
  }
  if (plan.tools.length) {
    lines.push(
      `Tools: ${plan.tools.map((t) => `${t.name}${t.required ? "" : " (optional)"}`).join(", ")}`
    );
  }
  if (plan.materials.length) {
    lines.push(
      `Materials: ${plan.materials
        .map((m) => `${m.name} (${m.quantity})`)
        .join(", ")}`
    );
  }
  lines.push("");
  lines.push("Steps:");
  plan.steps.forEach((s, i) => {
    lines.push(
      `${i + 1}. [${s.completed ? "x" : " "}] ${s.title}${
        s.estimatedMinutes ? ` (${s.estimatedMinutes} min)` : ""
      }`
    );
    if (s.criticalWarning) {
      lines.push(`   ⚠ DON'T MESS UP: ${s.criticalWarning}`);
    }
  });
  if (plan.safetyNotes.length) {
    lines.push("");
    lines.push("Safety notes:");
    plan.safetyNotes.forEach((n) => lines.push(`- ${n}`));
  }
  return lines.join("\n");
}

export interface ChatReply {
  text: string;
  proposal?: PlanProposal;
}

interface RawProposalInput {
  rationale: string;
  new_steps?: Array<{
    title: string;
    detail: string;
    estimated_minutes: number;
    critical_warning?: string;
  }>;
  new_tools?: Array<{ name: string; required: boolean }>;
  new_materials?: Array<{ name: string; quantity: string; notes?: string }>;
  new_safety_notes?: string[];
  new_difficulty?: string;
  new_total_minutes?: number;
  new_total_savings_usd?: number;
}

function parseProposal(raw: RawProposalInput): PlanProposal | undefined {
  const rationale = String(raw.rationale ?? "").trim();
  if (!rationale) return undefined;

  const proposal: PlanProposal = {
    rationale,
    status: "pending",
  };

  if (Array.isArray(raw.new_steps) && raw.new_steps.length > 0) {
    proposal.newSteps = raw.new_steps.map((s) => ({
      title: String(s.title),
      detail: String(s.detail),
      estimatedMinutes: Number(s.estimated_minutes) || 0,
      criticalWarning:
        typeof s.critical_warning === "string" &&
        s.critical_warning.trim().length > 0
          ? s.critical_warning.trim()
          : undefined,
    }));
  }
  if (Array.isArray(raw.new_tools) && raw.new_tools.length > 0) {
    proposal.newTools = raw.new_tools.map((t) => ({
      name: String(t.name),
      required: Boolean(t.required),
    }));
  }
  if (Array.isArray(raw.new_materials) && raw.new_materials.length > 0) {
    proposal.newMaterials = raw.new_materials.map((m) => ({
      name: String(m.name),
      quantity: String(m.quantity),
      notes: m.notes ? String(m.notes) : undefined,
    }));
  }
  if (Array.isArray(raw.new_safety_notes) && raw.new_safety_notes.length > 0) {
    proposal.newSafetyNotes = raw.new_safety_notes
      .map((n) => String(n))
      .filter((n) => n.length > 0);
  }
  if (raw.new_difficulty) {
    proposal.newDifficulty = normalizeDifficulty(raw.new_difficulty);
  }
  if (typeof raw.new_total_minutes === "number" && raw.new_total_minutes > 0) {
    proposal.newTotalMinutes = raw.new_total_minutes;
  }
  if (
    typeof raw.new_total_savings_usd === "number" &&
    raw.new_total_savings_usd >= 0
  ) {
    proposal.newTotalSavingsUsd = Math.round(raw.new_total_savings_usd);
  }

  // If the proposal has no actual changes (just a rationale), drop it.
  const hasChanges =
    !!proposal.newSteps ||
    !!proposal.newTools ||
    !!proposal.newMaterials ||
    !!proposal.newSafetyNotes ||
    !!proposal.newDifficulty ||
    !!proposal.newTotalMinutes ||
    proposal.newTotalSavingsUsd !== undefined;
  return hasChanges ? proposal : undefined;
}

export async function sendProjectChat(
  issue: Issue,
  requestMessages: ChatRequestMessage[]
): Promise<ChatReply> {
  const systemBlocks = [
    {
      type: "text" as const,
      text: CHAT_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: `CURRENT REPAIR PROJECT: "${issue.title}"\n\n${formatPlanForContext(issue.plan)}`,
    },
  ];

  // Chat follow-ups use Haiku — Q&A with plan context is straightforward.
  const data = (await callAnthropic({
    model: MODEL_HAIKU,
    max_tokens: 1500,
    system: systemBlocks,
    tools: [PROPOSE_UPDATES_TOOL],
    messages: toApiMessages(requestMessages),
  })) as ClaudeResponse;

  const text = data.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const toolUse = data.content.find(
    (b): b is { type: "tool_use"; name: string; input: unknown } =>
      b.type === "tool_use" && b.name === "propose_plan_updates"
  );

  let proposal: PlanProposal | undefined;
  if (toolUse) {
    proposal = parseProposal(toolUse.input as RawProposalInput);
  }

  return {
    text:
      text ||
      (proposal
        ? "I noticed something that might change your plan — take a look below."
        : ""),
    proposal,
  };
}

/**
 * Apply a user-accepted proposal to the plan. Additive only — existing
 * steps, tools, materials, and safety notes are preserved, as is any
 * per-item completion state the user had already set.
 */
export function applyProposalToPlan(
  plan: RepairPlan,
  proposal: PlanProposal
): RepairPlan {
  const newStepItems: PlanStep[] = (proposal.newSteps ?? []).map((s) => ({
    id: generateId(),
    title: s.title,
    detail: s.detail,
    estimatedMinutes: s.estimatedMinutes,
    criticalWarning: s.criticalWarning,
    completed: false,
  }));

  const newToolItems: ToolItem[] = (proposal.newTools ?? []).map((t) => ({
    id: generateId(),
    name: t.name,
    required: t.required,
    have: false,
  }));

  const newMaterialItems: MaterialItem[] = (proposal.newMaterials ?? []).map(
    (m) => ({
      id: generateId(),
      name: m.name,
      quantity: m.quantity,
      notes: m.notes,
      have: false,
    })
  );

  return {
    difficulty: proposal.newDifficulty ?? plan.difficulty,
    estimatedMinutes: proposal.newTotalMinutes ?? plan.estimatedMinutes,
    estimatedSavingsUsd:
      proposal.newTotalSavingsUsd ?? plan.estimatedSavingsUsd,
    tools: [...plan.tools, ...newToolItems],
    materials: [...plan.materials, ...newMaterialItems],
    steps: [...plan.steps, ...newStepItems],
    safetyNotes: [...plan.safetyNotes, ...(proposal.newSafetyNotes ?? [])],
    risk: plan.risk,
    suggestedReminders: plan.suggestedReminders,
    verificationResult: plan.verificationResult,
  };
}

// --------------------------------------------------------------------------
// Verify a finished-work photo
// --------------------------------------------------------------------------

const VERIFY_SYSTEM_PROMPT = `You are HandyBot verifying a homeowner's completed repair from a single photo. Be generous and encouraging on acceptance — if the work looks reasonable and matches the plan, verify it. Only reject when you can SEE a specific problem in the photo that needs concrete follow-up work.

When you reject:
- Be specific about what you see ("I can see the plumber's tape extending past the threads", "there's a gap in the caulk along the left edge").
- Return 1-5 concrete fix_steps the user should do to correct the problems. Each fix step should be a single clear action.
- You may include a critical_warning on a fix step when there is one specific mistake a novice often makes on that fix.

When you accept:
- Say warmly what you can see was done well. One or two sentences.
- Leave fix_steps empty or omit it.

You MUST call the verify_repair_from_photo tool. Do not reply with plain text.`;

interface RawFixStep {
  title: string;
  detail: string;
  estimated_minutes: number;
  critical_warning?: string;
}

interface RawVerifyInput {
  verified: boolean;
  feedback: string;
  fix_steps?: RawFixStep[];
}

export interface VerifyResult {
  verified: boolean;
  feedback: string;
  fixSteps: PlanStep[];
}

export async function verifyRepair(args: {
  issue: Issue;
  imageBase64: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<VerifyResult> {
  const planContext = formatPlanForContext(args.issue.plan);

  const userMessage: ChatRequestMessage = {
    role: "user",
    text:
      `Here is a photo of my finished repair for "${args.issue.title}". ` +
      `Please verify whether it looks right. If there's something I need to fix, give me concrete steps.\n\n` +
      `For context, this was the plan I just worked through:\n${planContext}`,
    imageBase64: args.imageBase64,
    imageMediaType: args.imageMediaType ?? "image/jpeg",
  };

  // Verification uses Sonnet — vision accuracy matters when judging quality.
  const data = (await callAnthropic({
    model: MODEL_SONNET,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: VERIFY_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [VERIFY_REPAIR_TOOL],
    tool_choice: { type: "tool", name: "verify_repair_from_photo" },
    messages: toApiMessages([userMessage]),
  })) as ClaudeResponse;

  const toolUse = data.content.find(
    (b): b is { type: "tool_use"; name: string; input: unknown } =>
      b.type === "tool_use" && b.name === "verify_repair_from_photo"
  );

  if (!toolUse) {
    throw new Error("Claude did not return a structured verification. Try again.");
  }

  const raw = toolUse.input as RawVerifyInput;
  const verified = Boolean(raw.verified);
  const feedback = String(raw.feedback ?? "").trim();

  const rawFix = Array.isArray(raw.fix_steps) ? raw.fix_steps : [];
  const fixSteps: PlanStep[] = verified
    ? []
    : rawFix
        .map((s) => ({
          id: generateId(),
          title: String(s.title ?? "").trim(),
          detail: String(s.detail ?? "").trim(),
          estimatedMinutes:
            typeof s.estimated_minutes === "number" ? s.estimated_minutes : undefined,
          criticalWarning:
            typeof s.critical_warning === "string" &&
            s.critical_warning.trim().length > 0
              ? s.critical_warning.trim()
              : undefined,
          completed: false,
        }))
        .filter((s) => s.title.length > 0);

  return { verified, feedback, fixSteps };
}

/**
 * Apply a verification result to a plan. Stores the result and appends any
 * fix-up steps to the end of the step list (with fresh IDs, completed=false).
 */
export function applyVerificationResult(
  plan: RepairPlan,
  verify: VerifyResult,
  photoUri?: string
): RepairPlan {
  const verificationResult: VerificationResult = {
    verified: verify.verified,
    feedback: verify.feedback,
    verifiedAt: Date.now(),
    photoUri,
    fixStepsAdded: verify.fixSteps.length,
  };

  return {
    ...plan,
    steps: verify.verified
      ? plan.steps
      : [...plan.steps, ...verify.fixSteps],
    verificationResult,
  };
}

// --------------------------------------------------------------------------
// Ask HandyBot anything (general home Q&A, no project required)
// --------------------------------------------------------------------------

const ASK_SYSTEM_PROMPT = `You are HandyBot, a friendly AI home expert. The user is asking a general question about their home — it might be about a potential problem, a weird noise, maintenance advice, product recommendations, or just curiosity.

Guidelines:
- Be warm, practical, and specific.
- If they include a photo, describe exactly what you see before answering.
- If something looks dangerous (mold, structural damage, gas smell, exposed wiring), say so clearly and recommend a professional.
- Keep answers concise — 2-4 short paragraphs max. Use bullet points for lists.
- If you're not sure, say so honestly rather than guessing.`;

export async function askHandyBot(
  messages: ChatRequestMessage[]
): Promise<string> {
  // General Q&A uses Haiku — fast, cheap, and the task is conversational.
  const data = (await callAnthropic({
    model: MODEL_HAIKU,
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: ASK_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: toApiMessages(messages),
  })) as ClaudeResponse;

  return data.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// --------------------------------------------------------------------------
// Home inventory item analysis
// --------------------------------------------------------------------------

const ANALYZE_ITEM_TOOL = {
  name: "analyze_home_item",
  description:
    "Analyze a photo of a home item (appliance, system, fixture) and identify it with estimated age and condition.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "What the item is, e.g. 'Gas water heater', 'GE side-by-side refrigerator', 'Carrier central AC unit'.",
      },
      category: {
        type: "string",
        enum: [
          "hvac",
          "plumbing",
          "electrical",
          "appliance",
          "structural",
          "exterior",
          "safety",
          "other",
        ],
      },
      estimated_age_years: {
        type: "integer",
        description:
          "Best-guess age in years based on model style, wear, and any visible date stickers.",
      },
      typical_lifespan_years: {
        type: "integer",
        description:
          "How long this type of item typically lasts with normal maintenance.",
      },
      condition: {
        type: "string",
        enum: ["good", "fair", "poor", "replace_soon"],
        description: "Visible condition based on the photo.",
      },
      condition_notes: {
        type: "string",
        description:
          "1-2 sentences about what you see — rust, wear, damage, cleanliness, etc.",
      },
      maintenance_tips: {
        type: "array",
        description: "2-4 short maintenance tips specific to this item.",
        items: { type: "string" },
      },
      icon: {
        type: "string",
        description: "Single emoji that best represents this item.",
      },
    },
    required: [
      "name",
      "category",
      "estimated_age_years",
      "typical_lifespan_years",
      "condition",
      "condition_notes",
      "maintenance_tips",
      "icon",
    ],
  },
} as const;

const ANALYZE_ITEM_SYSTEM = `You are HandyBot analyzing a photo of a home item for a homeowner's inventory. Identify what it is, estimate its age and condition from what you can see, and provide practical maintenance advice. Be specific about what you observe — mention brand names, model indicators, visible wear, rust, dates, stickers, etc. when you can see them.

You MUST call the analyze_home_item tool. Do not reply with plain text.`;

export interface AnalyzedItem {
  name: string;
  category: string;
  estimatedAgeYears: number;
  typicalLifespanYears: number;
  condition: "good" | "fair" | "poor" | "replace_soon";
  conditionNotes: string;
  maintenanceTips: string[];
  icon: string;
}

export async function analyzeHomeItem(args: {
  imageBase64: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  note?: string;
}): Promise<AnalyzedItem> {
  const userMessage: ChatRequestMessage = {
    role: "user",
    text:
      args.note?.trim() ||
      "What is this item? Please analyze its age, condition, and give me maintenance tips.",
    imageBase64: args.imageBase64,
    imageMediaType: args.imageMediaType ?? "image/jpeg",
  };

  // Item analysis uses Sonnet — vision accuracy for age/condition assessment.
  const data = (await callAnthropic({
    model: MODEL_SONNET,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: ANALYZE_ITEM_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [ANALYZE_ITEM_TOOL],
    tool_choice: { type: "tool", name: "analyze_home_item" },
    messages: toApiMessages([userMessage]),
  })) as ClaudeResponse;

  const toolUse = data.content.find(
    (b): b is { type: "tool_use"; name: string; input: unknown } =>
      b.type === "tool_use" && b.name === "analyze_home_item"
  );

  if (!toolUse) {
    throw new Error("Claude did not return item analysis. Try again.");
  }

  const raw = toolUse.input as Record<string, unknown>;
  const conditions = ["good", "fair", "poor", "replace_soon"] as const;
  const rawCondition = String(raw.condition ?? "fair");
  const condition = conditions.find((c) => c === rawCondition) ?? "fair";

  return {
    name: String(raw.name ?? "Unknown item").trim(),
    category: String(raw.category ?? "other").trim(),
    estimatedAgeYears: Number(raw.estimated_age_years) || 0,
    typicalLifespanYears: Number(raw.typical_lifespan_years) || 0,
    condition,
    conditionNotes: String(raw.condition_notes ?? "").trim(),
    maintenanceTips: Array.isArray(raw.maintenance_tips)
      ? (raw.maintenance_tips as string[]).map((t) => String(t).trim()).filter(Boolean)
      : [],
    icon: String(raw.icon ?? "🏠").trim().slice(0, 4) || "🏠",
  };
}
