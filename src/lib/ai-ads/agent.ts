// The conversational "creative director" layer. Before we touch the image models
// it reads the conversation and decides whether THIS turn should produce image(s)
// now, or just reply in words (answer, advise, brainstorm, ask a clarifying
// question) — making the studio feel like a real chat, not a prompt box.
// Fail-open: on any error it falls back to "generate" so nothing breaks.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface TurnPlan {
  generate: boolean; // true → make image(s); false → reply with words only
  message: string; // what to say to the user (conversational)
  suggestions: string[]; // 2-3 short next-step chips
}

export async function planTurn(opts: {
  text: string;
  hasRefs: boolean;
  refRoles: string[];
  hasPreviousImage: boolean;
  history?: string;
}): Promise<TurnPlan> {
  const fallback: TurnPlan = { generate: true, message: "", suggestions: [] };
  if (!GEMINI_API_KEY) return fallback;

  const instruction = `You are the creative director inside an AI ad-image chat studio (think ChatGPT image / Higgsfield) — warm, sharp, and helpful.
Decide what THIS turn needs and reply like a person, not a form.

Context for this turn:
- attached now: ${opts.hasRefs ? opts.refRoles.join(", ") || "image(s)" : "nothing"}
- a previous generated image exists: ${opts.hasPreviousImage}
${opts.history ? `Recent conversation:\n${opts.history}\n` : ""}
User said: "${opts.text || "(no text — just attachments)"}"

Choose ONE:
- "generate": the user clearly wants image(s) now — they described an ad, said make/create/another/more, asked to change/refine an existing image, or attached a product/reference with a creative direction. Set generate=true. Write "message" as a short, natural lead-in (1 sentence — what you're about to make), no hype.
- "reply": the user asked a question, wants ideas/advice/feedback, the request is too vague to make a good ad, or they're just talking. Set generate=false. Write "message" as a genuinely helpful reply (2-4 sentences): answer them, give concrete creative direction, and end by guiding them — ask ONE clarifying question or offer a couple of options. Do NOT pretend to have made an image.

Be decisive — don't ask questions you can reasonably assume. Keep "message" concise and conversational.
"suggestions": 2-3 tappable next-step ideas, each ≤ 5 words (e.g. "Make it warmer", "Try 4 variations", "Add a tagline").

Return STRICT JSON only: {"generate": true|false, "message": "...", "suggestions": ["...","..."]}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<TurnPlan>;
    return {
      generate: p.generate !== false, // default to generating
      message: typeof p.message === "string" ? p.message.trim() : "",
      suggestions: Array.isArray(p.suggestions)
        ? p.suggestions.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch (e) {
    console.error("[ai-ads] planTurn failed (non-fatal):", e);
    return fallback;
  }
}
