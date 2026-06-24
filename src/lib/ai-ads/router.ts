// The "router": reads a chat message + context and decides how to fulfil it —
// generate a new image or edit an existing one, with which model, what final
// image prompt, and what aspect ratio. Auto-route = the user just chats.

import type { ChatModelId } from "./chat-models";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

const ASPECTS = ["1:1", "4:5", "9:16", "16:9", "4:3", "3:4", "3:2", "2:3", "21:9"];
const MODELS: ChatModelId[] = ["nano-banana", "nano-banana-pro", "recraft", "ideogram"];

export interface RouteDecision {
  action: "generate" | "edit";
  model: ChatModelId;
  prompt: string;
  aspect: string;
}

export async function routeChat(opts: {
  text: string;
  attachmentCount: number;
  hasPreviousImage: boolean;
  history?: string;
}): Promise<RouteDecision> {
  const fallback: RouteDecision = {
    action: opts.attachmentCount > 0 || opts.hasPreviousImage ? "edit" : "generate",
    model: "nano-banana",
    prompt: opts.text,
    aspect: "1:1",
  };
  if (!GEMINI_API_KEY || !opts.text.trim()) return fallback;

  const instruction = `You route a request inside an AI image chat studio to ONE image action.
Context for THIS turn:
- images the user attached now: ${opts.attachmentCount}
- a previous generated image exists in the conversation: ${opts.hasPreviousImage}
${opts.history ? `Recent conversation:\n${opts.history}\n` : ""}
Rules:
- action "edit" when the user wants to change/modify an image that already exists — they attached one this turn, OR a previous image exists and they are refining it ("make it…", "add…", "remove…", "change…", "now…", "instead…"). Otherwise action "generate".
- model (only matters for "generate"): "nano-banana" = default, fast, versatile, good text; "nano-banana-pro" = highest quality and best text, use for posters or when legible text really matters; "recraft" = graphic design, logos, vector, clean poster layouts; "ideogram" = best typography / lots of text.
- prompt: a clear, self-contained image prompt that captures the user's intent. For edits, describe ONLY the change to make.
- aspect: one of ${ASPECTS.join(", ")}. Default "1:1". Posters/flyers often "4:5" or "2:3"; phone stories "9:16"; banners/wide "16:9".
Return STRICT JSON only: {"action":"...","model":"...","prompt":"...","aspect":"..."}
User request: "${opts.text}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(text) as Partial<RouteDecision>;
    return {
      action: p.action === "edit" ? "edit" : "generate",
      model: MODELS.includes(p.model as ChatModelId) ? (p.model as ChatModelId) : "nano-banana",
      prompt: typeof p.prompt === "string" && p.prompt.trim() ? p.prompt.trim() : opts.text,
      aspect: ASPECTS.includes(p.aspect ?? "") ? (p.aspect as string) : "1:1",
    };
  } catch {
    return fallback;
  }
}
