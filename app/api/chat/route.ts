import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import type { ChatRequestMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function splitDataUrl(dataUrl: string) {
  const match = /^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Unsupported image format");
  return {
    mediaType: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
    data: match[3],
  };
}

function toApiMessages(
  messages: ChatRequestMessage[]
): Array<{ role: "user" | "assistant"; content: ApiContentBlock[] }> {
  return messages.map((m) => {
    const content: ApiContentBlock[] = [];
    if (m.imageDataUrl) {
      const { mediaType, data } = splitDataUrl(m.imageDataUrl);
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    }
    if (m.text && m.text.trim().length > 0) {
      content.push({ type: "text", text: m.text });
    } else if (content.length === 0) {
      content.push({ type: "text", text: "(no message)" });
    }
    return { role: m.role, content };
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  let body: { messages?: ChatRequestMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: toApiMessages(messages),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return Response.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Claude API error:", message);
    return Response.json(
      { error: `Claude API error: ${message}` },
      { status: 500 }
    );
  }
}
