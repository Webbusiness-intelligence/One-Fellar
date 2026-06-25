// Image realism director for the Create studio. Enriches a plain image prompt into a
// realistic PHOTOGRAPH using the same realism playbook as the video director (see
// memory: reference_seedance_realism) — real skin, film grade, motivated lighting,
// lens, no plastic/3D look — adapting lighting/grade/lens/composition to the mood.
// Keeps the user's subject exactly; HONORS a non-photographic style if asked for
// (illustration, 3D, cartoon, anime, logo…); NSFW-safe; no on-screen text. Fail-open.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

// The photographic realism invariants — always applied unless the user wants a
// non-photo style.
const REALISM =
  "Shot on 35mm film, editorial photography. Natural skin with visible pores, subsurface scattering, fine vellus hair and subtle natural imperfections — never plastic, waxy or over-smoothed. Soft motivated natural light, a slightly desaturated film-grade 60:30:10 colour palette, fine grain, gentle highlight rolloff, shallow depth of field. True photographic realism — no 3D render, no cartoon, no CGI, no digital over-sharpening, no oversaturation.";

function fallback(prompt: string, skill?: string): string {
  const look = skill ? skill : REALISM;
  return `${prompt}. ${look} No added text, captions, watermark or logo.`;
}

export async function directImage(opts: {
  prompt: string; // the user's prompt (handles already swapped to names by the caller)
  mood?: string; // "auto" or a chosen mood/genre
  aspect?: string;
  subjects?: { tag: string; desc: string; kind: string }[];
  variation?: number;
  skill?: string; // a selected Skill's recipe (skillAddendum) — applied as the look
}): Promise<string> {
  if (!GEMINI_API_KEY) return fallback(opts.prompt, opts.skill);

  const mood = opts.mood && opts.mood !== "auto" ? opts.mood : "infer the best-fitting one from the scene";
  const subjectsBlock = opts.subjects?.length
    ? `\nSUBJECTS — feature each, keeping it accurate and recognisable: ${opts.subjects
        .map((s) => `${s.desc} (${s.kind})`)
        .join("; ")}.`
    : "";
  const skillBlock = opts.skill
    ? `\n\nSKILL — apply this with TOP PRIORITY (it defines the look, and OVERRIDES the photo-realism default above if it specifies a non-photographic style): ${opts.skill}`
    : "";

  const instruction = `You are an award-winning photographer + colourist. Rewrite the USER PROMPT into ONE rich, production-ready PHOTOGRAPH prompt${
    opts.aspect ? ` (aspect ${opts.aspect})` : ""
  } for an image model.

NEVER BREAK THESE:
1. Keep the user's SUBJECT exactly. Do NOT invent new subjects, props or scene — only add photographic craft.
2. If the user explicitly asks for a NON-photographic style (illustration, 3D render, cartoon, anime, watercolour, logo, vector, poster), HONOR that style and skip the photo-realism rules. Otherwise make it a genuine PHOTOGRAPH and include: ${REALISM}
3. NSFW-safe: composed, neutral phrasing (no sensual adjectives) so the safety filter does not reject it.
4. NO on-screen text, captions, watermark or logo unless the user explicitly asked.

ADAPT to the scene + mood (${mood}); for a photograph, choose what best fits (and make variation #${
    opts.variation ?? 0
  } a distinct combination so multiple images differ):
- Lighting setup (butterfly, Rembrandt, split, rim, window-soft, golden-hour, neon, low-key, high-key).
- Colour grade + film stock + 60:30:10 colours (teal-orange, faded pastel, Kodak Vision3, Fuji Eterna…), slightly desaturated, never oversaturated.
- Lens / focal length (24mm wide context, 35mm documentary-natural, 50mm neutral, 85mm f/1.8 beauty close-up bokeh).
- Shot size + camera angle + composition (rule of thirds, leading lines, depth layering, negative space).
- Time of day + practical atmosphere (haze, god-rays, lens flare, bokeh, halation — no CGI).${subjectsBlock}${skillBlock}

USER PROMPT: "${opts.prompt}"

Return STRICT JSON only: {"prompt":"the single enriched image prompt"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.85 + Math.min((opts.variation ?? 0) * 0.05, 0.2),
          },
        }),
      },
    );
    if (!res.ok) return fallback(opts.prompt, opts.skill);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<{ prompt: string }>;
    return p.prompt?.trim() || fallback(opts.prompt, opts.skill);
  } catch (e) {
    console.error("[ai-ads] directImage failed (non-fatal):", e);
    return fallback(opts.prompt, opts.skill);
  }
}
