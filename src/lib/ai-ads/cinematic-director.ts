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
    `Style: Large-format, high-fidelity — crisp edge-to-edge detail, rich tonal latitude, fine micro-texture, razor-clean focus plane with creamy fall-off; photoreal, no 3D render or game engine. Natural light only. 60:30:10 colour grade, slightly desaturated, fine film grain, soft highlight rolloff, halation on highlights, rich blacks, warm natural skin tones. ${REALISM} Audio: diegetic ambient and contact SFX only, no music. Avoid slow motion, plastic skin and oversaturation.`,
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

  const instruction = `You are an award-winning film DIRECTOR + cinematographer writing a HIGH-DETAIL, production-grade prompt for ${
    opts.subjects?.length ? "Seedance 2.0 reference-to-video" : "an image-to-video engine"
  } — ${opts.duration}s, aspect ${opts.aspect}, ${opts.mode === "ad" ? "an advertisement" : "cinematic"}.

Write video_prompt as LABELLED SECTIONS — VERY LONG and EXHAUSTIVE (aim 500–900 words). Describe EVERYTHING visible; NEVER a bare word. CRITICAL: never name a thing or an action without fully describing it — decompose every action FRAME-BY-FRAME from the FIRST frame to the LAST ("dances" → every step, weight shift, arm arc in degrees, head turn, hair follow-through, timed; "a car" → make/era, body lines, paint finish, EACH wheel + tyre rotating with tread grip + sidewall flex, suspension travel, glass reflections, speed in km/h; "sky" → colour gradient, cloud type + drift, sun position + light quality). Quantify everything — FOV in degrees/mm, handheld tremor in cm, Dutch angle in degrees, white balance in Kelvin, distances in cm/m, speeds, reaction timing in seconds, atmosphere density %. Use this exact architecture:

[STYLE] Lock the WHOLE look in one block (this header defines the film): format (describe as large-format, high-fidelity — crisp edge-to-edge detail, rich tonal latitude, fine micro-texture, razor-clean focus plane with creamy fall-off; anamorphic or clean spherical — do NOT state any pixel/resolution number like 4K or 8K, the delivery resolution is set separately), "photoreal — no 3D render, no game engine", cinematography philosophy, lighting approach, COLOUR 60:30:10 (dominant / secondary / accent) + white balance in Kelvin (e.g. WB 5600K), film stock + grade, lens character + 180° shutter motion blur, 24fps, pore-level skin (vellus hair, subsurface scattering, capillary flush, asymmetric imperfections), acting/performance direction, real-world physics paradigm, composition rules.
[SUBJECT] Every subject FULLY — face shape, skin (pores, texture, tone, sheen), hair (style, individual strands, movement), wardrobe (garment, fabric, fit, folds, exact colour), accessories, micro-expression; ONE consistent noun (or the @ImageN tags given), identity locked, scale.
[ELEMENTS] Every key object/prop FULLY — material, finish, condition/wear, exact colour, and how it BEHAVES (specs + motion: e.g. each wheel + tyre rotating with grip + sidewall flex, a drop's size + fall + impact).
[ACTION] Timecoded beats spanning ${opts.duration}s (0:00–0:0X …, few actions but each EXHAUSTIVELY decomposed frame-by-frame). Each beat: framing + FOV°, exactly ONE camera move, the action broken into micro-movements with biomechanics + momentum + contact + reaction timing, composition, and the cut ("hard cut" / "continuous").
[ENVIRONMENT] The full world — location, every surface (texture, reflectance), sky if visible, atmosphere (haze %, particles, god-rays), background life; described, not named.
[CAMERA] FOV per beat, handheld parameters (tremor in cm, or "locked-off / tripod"), stabilization note, Dutch angle in degrees if any, motion-blur emphasis.
[GRADE] colour dominance %, accent colour, WB in Kelvin, lighting-source restriction.
[CONSTRAINTS] aspect ${opts.aspect}; identity locks; real-world physics; REAL-TIME pace — NO slow motion unless the user explicitly asked; no on-screen text, subtitles or logos unless asked.
[AUDIO] diegetic SFX with timing; "NO MUSIC" unless the user asked.

NEVER BREAK:
1. Keep the user's SUBJECT and ACTION exactly — only add craft, never invent new subjects/props/plot.
2. Always include the realism invariants: ${REALISM}
3. NSFW-safe, composed neutral phrasing so the safety filter does not reject it.

ADAPT the look to the scene + mood (${mood}); make take #${opts.variation ?? 0} a DISTINCT combination — lighting setup (butterfly, Rembrandt, split, rim, window-soft, golden-hour, neon, low-key, chiaroscuro), film stock + 60:30:10 grade (teal-orange, bleach-bypass, faded pastel, Kodak Vision3, Fuji Eterna…), lens per beat (24/35/50/85mm f/1.8), camera angle + composition, practical atmosphere (haze %, god-rays, flare, bokeh, halation — no CGI) — so multiple takes differ.${subjectsBlock}${adBlock}

USER PROMPT: "${opts.prompt}"

JSON SAFETY: inside every string value use ONLY single quotes ' — never the double-quote character " — and output strictly valid JSON (escape newlines).
Return STRICT JSON only:
{
  "keyframe_prompt": "one photoreal FIRST-FRAME description carrying the locked lighting, lens, grade + pore-level skin; no text or watermark",
  "video_prompt": "the FULL labelled multi-section prompt (STYLE, SUBJECT, ACTION timecoded, CAMERA, GRADE, CONSTRAINTS, AUDIO) — rich and quantified",
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
            maxOutputTokens: 8192,
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

// ---------------------------------------------------------------------------
// Multi-shot CUT sequence — true cut-to-cut. Splits the prompt into N distinct
// SHOTS (each its own framing + camera move), all sharing ONE subject/scene via
// a hero base frame that we re-frame per shot. The route renders each shot and
// stitches them with hard cuts / cinematic transitions (ffmpeg xfade).
// ---------------------------------------------------------------------------

export type CutTransition = "cut" | "dissolve" | "fade" | "whip";

export interface CutSequence {
  styleHeader: string; // the locked [STYLE] block — prepended to EVERY shot so the cuts feel like one film
  baseKeyframePrompt: string; // one hero frame establishing the subject + look
  shots: Array<{
    keyframePrompt: string; // how to RE-FRAME the base for this shot (same subject)
    videoPrompt: string; // this shot's labelled sections (SUBJECT/ACTION/CAMERA/AUDIO) — header prepended at render
    durationSec: number; // >= minShot, all shots sum to ~total
    transition: CutTransition; // transition INTO this shot (first is ignored)
  }>;
  negativePrompt: string;
}

function cutsFallback(opts: { prompt: string; duration: number; minShot: number }): CutSequence {
  const n = Math.max(2, Math.min(3, Math.floor(opts.duration / opts.minShot)));
  const per = Math.max(opts.minShot, Math.round(opts.duration / n));
  const framings = ["a wide establishing shot", "a medium shot", "a close-up", "a detail insert"];
  const moves = ["slow dolly-in", "gentle pan", "subtle push-in", "slow tilt"];
  return {
    styleHeader: `[STYLE] Large-format, high-fidelity — crisp edge-to-edge detail, rich tonal latitude, fine micro-texture, razor-clean focus plane with creamy fall-off; photoreal, no 3D render or game engine. ${REALISM} 60:30:10 colour grade, slightly desaturated, soft highlight rolloff, fine film grain, WB 5600K. Diegetic SFX only, no music.`,
    baseKeyframePrompt: `${opts.prompt}. Photoreal, 35mm film, natural skin with visible pores and subsurface scattering, soft motivated cinematic lighting, slightly desaturated film grade, fine grain. No text or watermark.`,
    shots: Array.from({ length: n }, (_, i) => ({
      keyframePrompt: `${opts.prompt}, reframed as ${framings[i % framings.length]} of the same subject, consistent lighting and wardrobe.`,
      videoPrompt: `[SUBJECT] the same subject throughout.\n[ACTION] 0:00–0:0${per}: ${opts.prompt}, ${framings[i % framings.length]}, camera ${moves[i % moves.length]}, real-time natural pace.\n[AUDIO] diegetic ambience only, no music.`,
      durationSec: per,
      transition: (i === 0 ? "cut" : "cut") as CutTransition,
    })),
    negativePrompt: NEGATIVE,
  };
}

export async function directCuts(opts: {
  prompt: string; // user prompt (handles already swapped to names)
  duration: number; // total target seconds
  minShot: number; // engine minimum per shot (Seedance 4, Kling-pro 3, turbo 5)
  aspect: string;
  mode: "cinematic" | "ad";
  mood?: string;
  subjects?: Subject[];
  variation?: number;
}): Promise<CutSequence> {
  if (!GEMINI_API_KEY) return cutsFallback(opts);
  const maxShots = Math.max(2, Math.floor(opts.duration / opts.minShot));
  const mood = opts.mood && opts.mood !== "auto" ? opts.mood : "infer the best-fitting one from the scene";
  const subjectsBlock = opts.subjects?.length
    ? `\nSUBJECTS — keep each accurate and present in every relevant shot:\n${opts.subjects
        .map((s) => `${s.tag} = ${s.desc} (${s.kind})`)
        .join("\n")}`
    : "";

  const instruction = `You are an award-winning film DIRECTOR + editor. Turn the USER PROMPT into a TRUE CUT-TO-CUT ${
    opts.mode === "ad" ? "advertisement" : "cinematic"
  } sequence — total ${opts.duration}s, aspect ${opts.aspect}. It is rendered as SEPARATE shots and edited together, so design real EDITED SHOTS that all share ONE locked look.

First write a [STYLE] HEADER that locks the whole film (reused on EVERY shot): format (large-format, high-fidelity — crisp edge-to-edge detail, rich tonal latitude, fine micro-texture, razor-clean focus plane with creamy fall-off; anamorphic or clean spherical — do NOT state any pixel/resolution number like 4K or 8K, the delivery resolution is set separately), "photoreal — no 3D render, no game engine", lighting philosophy, COLOUR 60:30:10 + white balance in Kelvin (e.g. WB 5600K), film stock + grade, lens character + 180° shutter, 24fps, pore-level skin, physics paradigm, and audio approach ("diegetic SFX, no music" unless asked).

Then design the shots. For EACH shot write a VERY LONG, EXHAUSTIVELY DETAILED prompt (aim 300–550 words per shot) — do NOT repeat the style header (it is added automatically). Describe EVERYTHING visible; leave NOTHING as a bare word. CRITICAL RULE: never name a thing or an action without fully describing it — "dances" → every step, weight shift heel-to-toe, arm arc in degrees, hip rotation, head turn, hair follow-through, timed move by move; "a car" → make/era, body lines, paint finish, EACH wheel + tyre rotating with tread grip and sidewall flex, suspension travel, glass reflections, speed in km/h; "sky" → colour gradient, cloud type + drift direction, sun position + light quality. Sections:
[SUBJECT] Every person/creature, fully: face shape, skin (pores, texture, tone, sheen), hair (style, individual strands, movement), wardrobe (garment, fabric, fit, folds, exact colour), accessories, micro-expression. Identity + wardrobe IDENTICAL across shots.
[ELEMENTS] Every key object/prop, fully: material, finish, condition/wear, exact colour, and how it BEHAVES (specs + motion).
[ACTION — frame by frame] The beat's main action DECOMPOSED into its micro-movements from the FIRST frame to the LAST, with timecodes — never a bare verb. Include biomechanics, momentum, contact, and reaction timing in seconds.
[ENVIRONMENT] The full world: location, every surface (texture, reflectance), sky if visible, atmosphere (haze %, particles, god-rays), background life — described, not named.
[CAMERA] The director's camera woven through the WHOLE beat: shot size, FOV in mm, the ONE move with distance (cm) + speed + easing, lens character, focus/rack-focus pulls with timing, handheld tremor in cm or "locked-off", Dutch angle in degrees, motion blur.
[AUDIO] Layered diegetic SFX with timecodes (ambient bed + specific contact sounds).

NEVER BREAK THESE:
1. ONE consistent subject/scene across all shots (same person, wardrobe, location, time of day) — each shot is a different FRAMING/ANGLE, never a new character or place.
2. Produce between 2 and ${maxShots} shots. Each duration_sec is an integer >= ${opts.minShot}; all sum to ${opts.duration}.
3. Realism invariants (carried by the header): ${REALISM}
4. Vary framing across shots (wide/establishing, medium, close-up, ECU/detail insert, over-the-shoulder, profile). Real-time pace, NO slow motion unless asked.
5. NSFW-safe neutral phrasing. No on-screen text, captions, logos unless asked.

ADAPT to scene + mood (${mood}); make take #${opts.variation ?? 0} a distinct combination (lighting, film stock + 60:30:10 grade, lens per shot, atmosphere %).

TRANSITIONS — choose the transition INTO each shot (the first shot's is ignored): "cut" hard cut (DEFAULT, most boundaries), "dissolve" soft (time / emotion), "fade" through black (scene break / ending), "whip" fast smear (high-energy). Prefer "cut"; use others only WHERE NECESSARY.${subjectsBlock}

USER PROMPT: "${opts.prompt}"

JSON SAFETY: inside every string value use ONLY single quotes ' — never the double-quote character " — and output strictly valid JSON (escape newlines).
Return STRICT JSON only:
{
  "style_header": "the [STYLE] header block (format, photoreal, lighting, 60:30:10 + WB Kelvin, film stock, 180° shutter, 24fps, pore-level skin, physics, audio)",
  "base_keyframe_prompt": "one photoreal hero frame establishing the subject + the locked look; no text",
  "shots": [
    { "keyframe_prompt": "how to RE-FRAME the same hero subject for this shot (framing, angle, composition), subject/wardrobe/lighting consistent; no text", "video_prompt": "this shot's VERY LONG exhaustive sections [SUBJECT][ELEMENTS][ACTION frame-by-frame, timecoded][ENVIRONMENT][CAMERA][AUDIO] — describe every element fully, no bare words, camera woven through, WITHOUT the style header (300–550 words)", "duration_sec": <int >= ${opts.minShot}>, "transition": "cut|dissolve|fade|whip" }
  ],
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
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9 + Math.min((opts.variation ?? 0) * 0.05, 0.25),
            maxOutputTokens: 8192,
          },
        }),
      },
    );
    if (!res.ok) return cutsFallback(opts);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<{
      style_header: string;
      base_keyframe_prompt: string;
      shots: Array<Partial<{ keyframe_prompt: string; video_prompt: string; duration_sec: number; transition: string }>>;
      negative_prompt: string;
    }>;
    const fb = cutsFallback(opts);
    const validTransitions: CutTransition[] = ["cut", "dissolve", "fade", "whip"];
    const shots = (p.shots ?? [])
      .filter((s) => s.keyframe_prompt && s.video_prompt)
      .map((s) => ({
        keyframePrompt: s.keyframe_prompt!.trim(),
        videoPrompt: s.video_prompt!.trim(),
        durationSec: Math.max(opts.minShot, Math.round(Number(s.duration_sec) || opts.minShot)),
        transition: (validTransitions.includes(s.transition as CutTransition)
          ? (s.transition as CutTransition)
          : "cut") as CutTransition,
      }))
      .slice(0, maxShots);
    if (shots.length < 2) return fb;
    return {
      styleHeader: p.style_header?.trim() || fb.styleHeader,
      baseKeyframePrompt: p.base_keyframe_prompt?.trim() || fb.baseKeyframePrompt,
      shots,
      negativePrompt: p.negative_prompt?.trim() || NEGATIVE,
    };
  } catch (e) {
    console.error("[ai-ads] directCuts failed (non-fatal):", e);
    return cutsFallback(opts);
  }
}
