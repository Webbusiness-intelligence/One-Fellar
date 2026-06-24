// Commercial director: the brain of Commercial mode. Vision-reads the product,
// locks a production bible (kept consistent across scenes), then writes a premium,
// timed SHOT LIST for a multi-scene ad — built from the techniques top studios use:
//   • 2-second HOOK to open, then a real ad arc → brand end-card
//   • MCSLA per scene (Model·Camera·Subject·Look·Action)
//   • Style Prefix (8K photoreal, 60:30:10 colour, real physics, SFX-not-music)
//   • IDENTITY ≠ MOTION: product/character locked; motion described separately
//   • strong negative constraints; per-preset camera/register signature
// Returns a bible + ordered scenes (each with a keyframe prompt + a motion prompt).
// Fail-open with a sane default so the studio never hard-blocks.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface CommercialScene {
  summary: string; // short label
  keyframePrompt: string; // gpt-image prompt for this scene's start frame
  prompt: string; // structured Kling motion prompt (editable)
  duration: number; // seconds (3/5/10)
}
export interface CommercialPlan {
  bible: string; // product/character/brand/palette/mood — consistency anchor
  storyline: string; // polished creative treatment (big idea + narrative arc)
  negativePrompt: string;
  scenes: CommercialScene[];
}

const DEFAULT_NEGATIVE =
  "warped or morphing product, distorted or changing logo, garbled/flickering text, label deformation, extra limbs, extra fingers, duplicated objects, face/identity drift, glowing eyes, jitter, strobing, low quality, blur, artifacts, watermark";

// Per-preset camera + register signature (steers the whole ad's feel).
const PRESET_SIGNATURE: Record<string, string> = {
  tv_spot:
    "Premium broadcast TV commercial. Cinematic composed camera (dolly, crane, slow push-in). Aspirational, polished, brand-first. Arc: establishing → product hero → lifestyle/emotional beat → logo/CTA end-card.",
  hyper_motion:
    "Kinetic product hero. Every shot moves — whip-pans, orbits, speed-ramps, match cuts, product rotation. Bold colour, high contrast. Product is hero every frame. Beat-driven.",
  ugc:
    "Phone-native, authentic, handheld. Eye-level or selfie framing, natural imperfect light, real environment. Casual, relatable.",
  unboxing:
    "Premium reveal. Hands in frame, tactile close-ups, top-down or 3/4 on a clean surface, satisfying reveal moments.",
  product_review:
    "Honest talking-head register with the product in hand; medium shots + B-roll inserts of product detail. Measured, trustworthy.",
  wild_card:
    "Surreal, conceptual, boundary-pushing. Impossible geometry/scale, dreamlike transitions, one striking idea — product stays the anchor.",
};

export async function buildCommercial(opts: {
  imageUrl: string;
  brief?: string;
  durationTarget: number; // total seconds (15-60)
  preset: string;
  format: string;
  assets?: Array<{ tag: string; role: string; label: string }>;
}): Promise<CommercialPlan> {
  const sceneLen = 5;
  const sceneCount = Math.max(3, Math.min(Math.round(opts.durationTarget / sceneLen), 10));
  const fallback: CommercialPlan = {
    bible: "Premium hero-product commercial",
    storyline: "A premium hero-product story: an intriguing hook, a beautiful product reveal, an aspirational lifestyle beat, and a confident brand close.",
    negativePrompt: DEFAULT_NEGATIVE,
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      summary: i === sceneCount - 1 ? "Brand end-card" : `Scene ${i + 1}`,
      keyframePrompt: `Cinematic premium commercial frame featuring the exact product from the reference, photoreal, dramatic lighting, shallow depth of field, ${opts.format}`,
      prompt: `Cinematic ${i % 2 ? "slow dolly-in" : "gentle orbit"} on the hero product; shallow depth of field; premium volumetric light; refined teal-and-orange 60:30:10 grade; elegant pacing over ${sceneLen}s; product, label and text perfectly stable; SFX only, no music.`,
      duration: sceneLen,
    })),
  };
  if (!GEMINI_API_KEY) return fallback;

  let imagePart: { inline_data: { mime_type: string; data: string } } | null = null;
  try {
    const buf = Buffer.from(await (await fetch(opts.imageUrl)).arrayBuffer());
    imagePart = { inline_data: { mime_type: "image/png", data: buf.toString("base64") } };
  } catch {
    /* text-only fallback */
  }

  const signature = PRESET_SIGNATURE[opts.preset] ?? PRESET_SIGNATURE.tv_spot;
  const assetsLine =
    opts.assets && opts.assets.length
      ? `\nNAMED PRODUCTION ASSETS — you MUST feature these and keep each one consistent across scenes, referring to them by @tag in the scene text:\n${opts.assets
          .map((a) => `- @${a.tag} (${a.role}): ${a.label}`)
          .join(
            "\n",
          )}\nWeave any CHARACTER into the relevant scenes (they appear, interact with the product), set scenes in/at any LOCATION asset, and use any PROP where it fits. The product stays the hero throughout.`
      : "";

  const instruction = `You are an award-winning commercial director + DP (Cannes Lions / Super Bowl calibre) creating a ${opts.durationTarget}-second ad (${opts.format}).
PRESET / FEEL: ${signature}

STEP 1 — Lock a PRODUCTION BIBLE from the reference image: the exact HERO PRODUCT (form, label, branding, colours), any CHARACTER (look/wardrobe), the brand, a disciplined colour palette, and the mood. These MUST stay identical across every scene (identity locked; only motion changes per scene).

STEP 2 — Write a POLISHED STORYLINE — a premium creative treatment worthy of a $1,000,000 brand film, NOT a product demo. It must contain:
- THE BIG IDEA: one bold, ownable concept/metaphor that makes this ad unforgettable.
- LOGLINE: one vivid sentence capturing the whole film.
- NARRATIVE ARC: a real dramatic arc — an arresting hook / inciting moment → rising tension or desire → a climax / peak emotional beat → resolution & catharsis that lands on the brand.
- PROTAGONIST & STAKES: who we follow and what they want/feel (even if the product itself is the hero).
- EMOTIONAL THROUGHLINE: the single feeling the audience should leave with.
- BRAND PAYOFF + CTA: how it resolves into the logo/message.
Write the storyline as 4-7 flowing sentences (a treatment a creative director would pitch).

STEP 3 — Break THAT storyline into scenes that EXECUTE it (open on a 2-second scroll-stopping hook, build the arc, close on a premium brand end-card with the product/logo and room for a CTA). Choose how many scenes the story needs and give EACH scene a duration of 3, 5 or 10 seconds based on its beat (a quick cut = 3s, a standard beat = 5s, a hero/emotional/complex moment = 10s); the durations should sum to roughly ${opts.durationTarget}s. Vary camera and composition — never repeat a shot.

For EACH scene return:
- "keyframe_prompt": a detailed IMAGE prompt for the scene's first frame — a distinct, gorgeous cinematic frame that FEATURES THE EXACT PRODUCT from the reference (same form/label/branding), photoreal commercial photography, specific lighting + composition, ${opts.format}. No ad headlines/logos/CTA text baked in unless the scene is the end-card.
- "motion_prompt": how the video model animates that frame, written with this structure woven into one flowing paragraph (NOT labelled):
   · CAMERA: one deliberate move + lens (e.g. "35mm gimbal push-in", "slow orbit", "crane up", "FPV weave"); 180° shutter motion blur.
   · SUBJECT: the product/character — "matches the reference 100%", kept photographically exact and stable.
   · LOOK: a 60:30:10 colour grade (dominant/secondary/accent), filmic, fine grain.
   · ACTION: realistic motion + physics broken into beats across the scene's chosen duration (real gravity/inertia; liquid/splash/steam/fabric where apt); rule-of-thirds composition, in motion from frame one.
   · AUDIO: ambient + tasteful foley/SFX only (no music — music is added in the edit).
   · CONSTRAINTS (negations): keep product/label/text perfectly stable and legible, NO warping/morphing, NO glowing eyes, scale locks where relevant.
- "summary": max 6 words.

Also return a short "bible" (1-2 sentences: product + look), the "storyline" (the treatment from STEP 2), and a tuned "negative_prompt".
${opts.brief ? `\nClient brief to honour across the whole ad: ${opts.brief}` : ""}${assetsLine}
Return STRICT JSON only: {"bible":"...","storyline":"...","negative_prompt":"...","scenes":[{"keyframe_prompt":"...","motion_prompt":"...","summary":"...","duration":5}]} — choose the scene count and per-scene durations so they sum to about ${opts.durationTarget}s.`;

  try {
    const parts: Array<unknown> = [{ text: instruction }];
    if (imagePart) parts.push(imagePart);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.85 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<{
      bible: string;
      storyline: string;
      negative_prompt: string;
      scenes: Array<{
        keyframe_prompt?: string;
        motion_prompt?: string;
        summary?: string;
        duration?: number;
      }>;
    }>;
    const scenes = (p.scenes ?? [])
      .map((s) => ({
        keyframePrompt: (s.keyframe_prompt ?? "").trim(),
        prompt: (s.motion_prompt ?? "").trim(),
        summary: (s.summary ?? "").trim() || "Scene",
        duration: [3, 5, 10].includes(Number(s.duration)) ? Number(s.duration) : sceneLen,
      }))
      .filter((s) => s.keyframePrompt && s.prompt);
    if (!scenes.length) return fallback;
    return {
      bible: p.bible?.trim() || fallback.bible,
      storyline: p.storyline?.trim() || fallback.storyline,
      negativePrompt: p.negative_prompt?.trim() || DEFAULT_NEGATIVE,
      scenes,
    };
  } catch (e) {
    console.error("[ai-ads] buildCommercial failed (non-fatal):", e);
    return fallback;
  }
}
