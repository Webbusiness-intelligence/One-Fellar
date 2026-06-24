// Premium prompt enhancer ("Art Director" layer): rewrites a plain concept into
// a rich, photorealistic prompt — camera/lens, lighting, composition, materials,
// micro-detail, color grading, aesthetic reference + quality cues. This is the
// single biggest lever on perceived quality. Fail-open: returns the original on
// any error so it can never block generation.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function enhancePrompt(opts: { prompt: string }): Promise<string> {
  const base = opts.prompt.trim();
  if (!GEMINI_API_KEY || !base) return base;

  const instruction = `You are a world-class advertising photographer and cinematographer behind award-winning campaigns.
Rewrite the concept below into ONE single, richly detailed, photorealistic image prompt for an ULTRA-PREMIUM ad.
Keep the subject and intent EXACTLY. If the concept already specifies art direction (a camera lens, angle, lighting or look), you MUST use those exact choices; otherwise choose the most premium, flattering options. Enrich with:
- a camera body + a specific lens, focal length and aperture, and the depth of field / bokeh it produces (e.g. "shot on 85mm f/1.4, shallow depth of field, creamy bokeh")
- a deliberate camera angle / shot type (e.g. low hero angle, eye-level three-quarter, overhead flat-lay, macro close-up)
- a professional lighting setup named precisely (e.g. soft diffused window light, Rembrandt key with rim separation, butterfly beauty light, golden-hour backlight)
- composition using real principles (rule of thirds, negative space, leading lines, foreground depth)
- materials and fine surface micro-detail (texture, reflections, condensation, fabric weave, subtle real-world imperfections)
- a tasteful colour grade and ONE aesthetic reference (e.g. "premium Apple product photography", "Kinfolk editorial", "Vogue beauty")
End with concise quality cues: "ultra-detailed, sharp focus, professional commercial photography, natural colour grading, true-to-life textures, no plastic look, no artifacts".
Do NOT invent brand logos, text or words that weren't requested. Do NOT change the product itself.
Return ONLY the final prompt as one paragraph — no preamble, quotes or labels.

Concept: "${base}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { temperature: 0.7 },
        }),
      },
    );
    if (!res.ok) return base;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");
    return text.length > base.length ? text : base;
  } catch (e) {
    console.error("[ai-ads] enhancePrompt failed (non-fatal):", e);
    return base;
  }
}
