import { generateId } from "./storage";
import type {
  ChatRequestMessage,
  Difficulty,
  Issue,
  MaterialItem,
  PlanStep,
  RepairPlan,
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

You MUST call the create_repair_plan tool. Do not reply with plain text.`;

const CHAT_SYSTEM_PROMPT = `You are HandyBot, a friendly and knowledgeable AI handyman helping a homeowner work through a specific repair project.

You have an existing repair plan for this project (provided below). The user is checking in with updates, follow-up photos, or questions as they work through the steps.

Guidelines:
- Refer to steps by their number and short title when relevant.
- Acknowledge progress when the user shows you something they've done.
- Adapt your advice to what you can actually see in any new photos.
- Keep messages warm, short, and practical — the user is mid-repair.
- If you see something that would change the plan (e.g. new damage, wrong part), tell the user plainly and suggest what to add or change.
- Only flag safety concerns that are specific and actionable.

Do not repeat the full plan back to the user — they can already see it in the app.`;

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
      "tools",
      "materials",
      "steps",
      "safety_notes",
      "opening_message",
    ],
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
  tools: Array<{ name: string; required: boolean }>;
  materials: Array<{ name: string; quantity: string; notes?: string }>;
  steps: Array<{ title: string; detail: string; estimated_minutes?: number }>;
  safety_notes: string[];
  opening_message: string;
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

  return {
    title: String(raw.title || "New repair").trim(),
    summary: String(raw.summary || "").trim(),
    openingMessage: String(raw.opening_message || "").trim(),
    plan: {
      difficulty: normalizeDifficulty(raw.difficulty),
      estimatedMinutes: Number(raw.estimated_minutes) || 0,
      tools,
      materials,
      steps,
      safetyNotes: Array.isArray(raw.safety_notes)
        ? raw.safety_notes.map((s) => String(s)).filter(Boolean)
        : [],
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

export async function sendProjectChat(
  issue: Issue,
  requestMessages: ChatRequestMessage[]
): Promise<string> {
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
    messages: toApiMessages(requestMessages),
  })) as ClaudeResponse;

  return data.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
