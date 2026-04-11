import type { ChatRequestMessage } from "./types";

const SYSTEM_PROMPT = `You are HandyBot, a friendly and knowledgeable AI handyman that helps everyday homeowners diagnose and fix things around their house.

When a user sends a photo of a problem:
1. Identify what you see in the image.
2. Explain what is most likely wrong in plain, simple language.
3. Give clear, numbered step-by-step instructions for a fix the user can realistically do themselves.
4. List any tools or materials they will need, using common names.
5. Flag any safety concerns and say clearly when something is a job for a licensed professional (electrician, plumber, gas, structural, roof, etc.).

When follow-up photos or messages arrive:
- Treat the conversation as an ongoing repair session for this one specific issue.
- Acknowledge the progress the user has made.
- Adapt your advice based on what the new picture shows.
- Keep the user oriented: remind them what step they are on and what is next.

Style:
- Warm, patient, and encouraging — your users are not tradespeople.
- Short paragraphs. Use bullet points and numbered steps where helpful.
- Never invent details about things you cannot see. If you are unsure, ask for a clearer photo or a specific detail.

For the VERY FIRST message in a new issue, begin your reply with a single line in this exact format so the app can use it as a title:
TITLE: <a short 3-6 word description of the problem>

Then continue with your normal diagnosis and fix on the next line.`;

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const ANTHROPIC_VERSION = "2023-06-01";

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

export async function sendChat(messages: ChatRequestMessage[]): Promise<string> {
  const apiKey = getApiKey();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      // React Native fetch has no browser Origin header, but Anthropic still
      // gates non-server callers on this opt-in header.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: toApiMessages(messages),
    }),
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

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

export function extractTitle(text: string): { title: string; body: string } {
  const match = /^\s*TITLE:\s*(.+?)\s*(?:\r?\n|$)/i.exec(text);
  if (match) {
    return {
      title: match[1].trim(),
      body: text.slice(match[0].length).trimStart(),
    };
  }
  return { title: "", body: text };
}

export function buildSummary(body: string): string {
  const firstLine = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "Continue the repair conversation.";
  return firstLine.length > 140 ? firstLine.slice(0, 137) + "..." : firstLine;
}
