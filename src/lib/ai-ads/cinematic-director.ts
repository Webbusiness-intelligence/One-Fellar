// Adaptive cinematic director for the Video studio. Turns a plain user prompt into
// a production-ready, realistic Seedance/Kling prompt that applies the full realism
// playbook (see memory: reference_seedance_realism). It KEEPS the user's subject and
// action exactly (never invents), but ADAPTS the creative axes (genre / ad-format,
// lighting, colour grade, lens-per-beat, camera, atmosphere, pacing) to the scene +
// mood, and varies each take so N variations don't look identical.
//
// Returns: keyframePrompt (photoreal first frame for image-to-video), videoPrompt
// (the structured motion prompt), negativePrompt. Fail-open: a deterministic
// scaffold if Gemini is unavailable.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface CinematicShot {
  keyframePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
}

// Constant realism invariants — ALWAYS applied (the non-negotiables).
const REALISM =
  "Pore-level skin realism — vellus hair, subsurface scattering, capillary flush, asymmetric natural imperfections, never plastic or waxy. Real-world physics — gravity and inertia respected, correct weight transfer per step, momentum on cloth and hair, correct contact shadows. Physical cine lens, 180° shutter motion blur, shallow depth of field. The video runs at 24 fps, real-time playback speed, steady natural pace — no repeated frames, NO slow motion, not floaty.";

const NEGATIVE =
  "slow motion, plastic or waxy skin, over-smoothed faces, digital over-sharpening, oversaturation, 3D render, cartoon, CGI look, morphing, distorted hands, extra fingers, flickering, warping, jitter, floaty drift, low quality, blur, watermark, on-screen text";

export type Subject = { tag: string; desc: string; kind: string };

// Deterministic fallback if Gemini is unavailable — still timecoded + realistic.
function fallback(opts: {
  prompt: string;
  duration: number;
  subjects?: Subject[];
}): CinematicShot {
  const subjectLine = opts.subjects?.length
    ? opts.subjects.map((s) => `${s.tag} = ${s.desc} (${s.kind})`).join("; ")
    : "";
  const half = Math.max(2, Math.round(opts.duration / 2));
  const video = [
    `Style: 8K photoreal, no 3D render or game engine. Natural light only. 60:30:10 colour grade, slightly desaturated, fine film grain, soft highlight rolloff, halation on highlights, rich blacks, warm natural skin tones. ${REALISM} Audio: diegetic ambient and contact SFX only, no music. Avoid slow motion, plastic skin and oversaturation.`,
    subjectLine ? `Subjects: ${subjectLine}.` : "",
    `Subject: the same subject throughout.`,
    `0–${half}s: ${opts.prompt}, at a natural real-time pace. Camera: slow dolly-in, 35mm.`,
    `${half}–${opts.duration}s: the action continues and settles naturally. Camera: gentle ease to a hold.`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    keyframePrompt: `${opts.prompt}. Photoreal, 35mm film, natural skin with visible pores and subsurface scattering, soft motivated cinematic lighting, slightly desaturated film grade, fine grain. No text or watermark.`,
    videoPrompt: video,
    negativePrompt: NEGATIVE,
  };
}

export async function directCinematic(opts: {
  prompt: string; // the user's prompt (handles already swapped to names by the caller)
  duration: number;
  aspect: string; // "16:9" | "9:16" | …
  mode: "cinematic" | "ad";
  mood?: string; // "auto" or a chosen genre/format/mood
  subjects?: Subject[]; // referenced Soul IDs to bind by tag (e.g. @Image1)
  variation?: number; // 0..N — make each take a different creative combination
}): Promise<CinematicShot> {
  if (!GEMINI_API_KEY) return fallback(opts);

  const mood = opts.mood && opts.mood !== "auto" ? opts.mood : "infer the best-fitting one from the scene";
  const subjectsBlock = opts.subjects?.length
    ? `\nSUBJECTS — feature each and refer to it EXACTLY by its tag (do not rename), keeping it accurate:\n${opts.subjects
        .map((s) => `${s.tag} = ${s.desc} (${s.kind})`)
        .join("\n")}`
    : "";

  const adBlock =
    opts.mode === "ad"
      ? `\nThis is an ADVERTISEMENT. Pick the best AD FORMAT (UGC/testimonial, before-after, unboxing, product demo, lifestyle, founder story, hero product, comparison, ASMR, hyper-motion/logo, TV spot) and structure the timecoded beats as: a 2-second scroll-stopping HOOK → show the product/benefit clearly → a clean payoff. Keep it diegetic; NO on-screen text or logo unless the user asked.`
      : "";

  const instruction = `You are an award-winning film DIRECTOR and cinematographer. Convert the USER PROMPT into ONE production-ready ${
    opts.mode === "ad" ? "advertisement" : "cinematic"
  } video prompt for ${
    opts.subjects?.length ? "Seedance 2.0 reference-to-video" : "an image-to-video engine"
  } — ${opts.duration} seconds, aspect ${opts.aspect}.

NEVER BREAK THESE:
1. Keep the user's SUBJECT and ACTION exactly. Do NOT invent new subjects, props, locations or plot — only add cinematic craft.
2. ALWAYS include the realism invariants: ${REALISM}
3. ADHERENCE: break the action into TIMECODED beats that fit ${opts.duration}s (~1 beat per 3–4s; do not cram). Use ONE consistent noun for the subject across all beats. Exactly ONE dominant camera move per beat. Close with a global style line. Every element you write must be something the engine can show — nothing vague.
4. NSFW-safe: use composed, neutral phrasing (no sensual adjectives) so the safety filter does not reject it.
5. NO on-screen text, captions, watermark or logo unless the user explicitly asked.

ADAPT to the scene and mood (${mood}); make THIS take (#${opts.variation ?? 0}) a DISTINCT creative combination so multiple takes don't look the same — choose from:
- ${opts.mode === "ad" ? "ad format" : "genre/style (cinematic, documentary, noir, romance, fashion, music-video, sci-fi, etc.)"} + emotional tone.
- Lighting setup (butterfly, Rembrandt, split, rim, window-soft, golden-hour, neon, low-key, high-key, chiaroscuro).
- Colour grade + film stock + 60:30:10 colours (teal-orange, bleach-bypass, faded pastel, Kodak Vision3, Fuji Eterna…), slightly desaturated, never oversaturated.
- Lens per beat (24mm wide/context, 35mm documentary-natural, 50mm neutral, 85mm f/1.8 beauty close-up bokeh) + shot size + camera angle + composition (rule of thirds, leading lines, depth layering).
- Time of day + weather + PRACTICAL atmosphere (haze, god-rays, lens flare, bokeh, steam, halation — no CGI).
- Pacing/energy (serene, brisk, kinetic, tense) — but always REAL-TIME, never slow-motion.
- Camera vocab: dolly, truck, pedestal, pan, tilt, crane, orbit, arc, tracking, static, push-in, pull-out, whip-pan, rack-focus + gimbal/steadicam/handheld for smoothness.${subjectsBlock}${adBlock}

USER PROMPT: "${opts.prompt}"

Return STRICT JSON only:
{
  "keyframe_prompt": "a single photoreal FIRST-FRAME description carrying the chosen lighting, lens and grade + real skin; no text or watermark",
  "video_prompt": "the full structured prompt: a Style line (realism invariants + the chosen look), the consistent Subject noun, the TIMECODED beats each with its camera move + lens + real-time action and physics, a Static line for the set, and an Audio line (diegetic only, no music). Fold a short 'avoid slow motion, plastic skin, oversaturation' clause in.",
  "negative_prompt": "a tuned negative prompt"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          // A little heat so takes differ; nudged by the variation index.
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9 + Math.min((opts.variation ?? 0) * 0.05, 0.25),
          },
        }),
      },
    );
    if (!res.ok) return fallback(opts);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<{
      keyframe_prompt: string;
      video_prompt: string;
      negative_prompt: string;
    }>;
    const fb = fallback(opts);
    return {
      keyframePrompt: p.keyframe_prompt?.trim() || fb.keyframePrompt,
      videoPrompt: p.video_prompt?.trim() || fb.videoPrompt,
      negativePrompt: p.negative_prompt?.trim() || NEGATIVE,
    };
  } catch (e) {
    console.error("[ai-ads] directCinematic failed (non-fatal):", e);
    return fallback(opts);
  }
}
