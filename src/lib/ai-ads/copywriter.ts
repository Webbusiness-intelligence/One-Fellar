// Ad copywriter: turns an ad concept (image prompt / product) into ready-to-post
// marketing copy — hook, headline, caption, CTA, hashtags. Gemini, JSON mode.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface AdCopy {
  hook: string;
  headline: string;
  caption: string;
  cta: string;
  hashtags: string[];
}

export async function writeAdCopy(opts: {
  prompt: string;
  productName?: string | null;
  brand?: string | null;
  platform?: string;
  tone?: string | null;
  count?: number;
}): Promise<AdCopy[]> {
  if (!GEMINI_API_KEY || !opts.prompt.trim()) return [];
  const count = Math.min(Math.max(opts.count ?? 1, 1), 5);

  const instruction = `You are a world-class direct-response ad copywriter.
Write ${count} distinct ad-copy variant(s) for this ad.
${opts.productName ? `Product: "${opts.productName}".` : ""}
${opts.brand ? `Brand: "${opts.brand}".` : ""}
Ad concept: "${opts.prompt}".
Platform: ${opts.platform ?? "general social"}.${opts.tone ? ` Brand voice/tone: ${opts.tone}.` : ""}

Each variant must have:
- "hook": a scroll-stopping first line (max ~10 words)
- "headline": a short punchy headline (max ~8 words)
- "caption": a 1-2 sentence post caption that sells the benefit
- "cta": a strong call to action (max ~6 words)
- "hashtags": 3-6 relevant hashtags, lowercase, no spaces, no leading '#'

Return STRICT JSON only:
{"variants":[{"hook":"","headline":"","caption":"","cta":"","hashtags":[]}]}
with exactly ${count} item(s).`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
        }),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as { variants?: Array<Partial<AdCopy>> };
    return (parsed.variants ?? []).slice(0, count).map((v) => ({
      hook: String(v.hook ?? ""),
      headline: String(v.headline ?? ""),
      caption: String(v.caption ?? ""),
      cta: String(v.cta ?? ""),
      hashtags: Array.isArray(v.hashtags)
        ? v.hashtags.map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 6)
        : [],
    }));
  } catch (e) {
    console.error("[ai-ads] copywriter failed:", e);
    return [];
  }
}
