// Variations: expand one ad concept into N DISTINCT visual angles (different
// compositions, settings, moods, hooks) for the same subject — to batch-produce
// fresh creative and beat ad fatigue. Gemini, JSON mode.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function variationPrompts(opts: {
  prompt: string;
  count: number;
}): Promise<string[]> {
  const count = Math.min(Math.max(opts.count, 2), 12);
  const fallback = Array.from({ length: count }, () => opts.prompt);
  if (!GEMINI_API_KEY || !opts.prompt.trim()) return fallback;

  const instruction = `You are an elite advertising photographer and art director producing a fresh batch of ad creative.
Given this ad concept, write ${count} DISTINCT, photorealistic, PREMIUM image prompts — vary the composition, setting, camera angle, lighting, mood and creative hook — while keeping the SAME product/subject and core intent.
Each prompt must read like a pro brief: include a specific camera + lens and depth of field, a described lighting setup, fine surface/material micro-detail, tasteful color grading, and end with "sharp focus, professional photography, high detail, natural color grading". Do NOT invent logos or text. Each must be complete and self-contained (don't reference "variation 1").
Concept: "${opts.prompt}".
Return STRICT JSON only: {"variations":["...","..."]} with exactly ${count} items.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 1.0 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as { variations?: string[] };
    const out = (parsed.variations ?? [])
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, count);
    return out.length ? out : fallback;
  } catch (e) {
    console.error("[ai-ads] variationPrompts failed:", e);
    return fallback;
  }
}
