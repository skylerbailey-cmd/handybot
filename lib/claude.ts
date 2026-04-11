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
  ToolItem,
} from "./types";

const MODEL = "claude-sonnet-4-6";
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
          },
          required: ["name", "quantity"],
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
  materials: Array<{ name: string; quantity: string; notes?: string }>;
  steps: Array<{ title: string; detail: string; estimated_minutes?: number }>;
  safety_notes: string[];
  risk?: {
    severity?: string;
    category?: string;
    headline?: string;
    rationale?: string;
    call_a_pro_recommended?: boolean;
  };
  opening_message: string;
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
    have: false,
  }));

  const steps: PlanStep[] = (raw.steps ?? []).map((s) => ({
    id: generateId(),
    title: String(s.title),
    detail: String(s.detail),
    estimatedMinutes:
      typeof s.estimated_minutes === "number" ? s.estimated_minutes : undefined,
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

  const data = (await callAnthropic({
    model: MODEL,
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
  new_steps?: Array<{ title: string; detail: string; estimated_minutes: number }>;
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

  const data = (await callAnthropic({
    model: MODEL,
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
  };
}
