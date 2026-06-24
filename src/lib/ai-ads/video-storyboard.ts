// Commercial "storyboard director": vision-reads the ad, locks a production bible
// (product / character / brand kept consistent), then writes a cinematic SHOT LIST
// for a premium multi-shot commercial. Each shot has a keyframe prompt (the start
// frame to generate) and a motion prompt (how Kling animates it). The original ad
// is added by the route as the closing brand end-card. Fail-open with a default.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface Shot {
  keyframePrompt: string; // image prompt for this shot's start frame (product consistent)
  motionPrompt: string; // Kling cinematic motion for this shot
  summary: string; // short label
}
export interface Storyboard {
  bible: string; // product/character/brand/palette/mood (for the UI + consistency)
  negativePrompt: string;
  shots: Shot[];
}

const DEFAULT_NEGATIVE =
  "warped or morphing product, distorted or changing logo, garbled text, label deformation, extra limbs, duplicated objects, face distortion, jitter, flicker, low quality, blur, artifacts, watermark";

export async function buildStoryboard(opts: {
  imageUrl: string;
  brief?: string;
  sceneShots: number;
  shotDuration: number;
}): Promise<Storyboard> {
  const fallback: Storyboard = {
    bible: "Hero product commercial",
    negativePrompt: DEFAULT_NEGATIVE,
    shots: Array.from({ length: opts.sceneShots }, (_, i) => ({
      keyframePrompt: `Cinematic premium commercial scene ${i + 1} featuring the exact product from the reference, photoreal, dramatic lighting, shallow depth of field`,
      motionPrompt: `Smooth ${i % 2 ? "slow dolly-in" : "gentle orbit"} on the hero product, shallow depth of field, premium volumetric light, refined teal-and-orange grade, elegant pacing over ${opts.shotDuration}s; keep the product and label perfectly stable`,
      summary: `Scene ${i + 1}`,
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

  const instruction = `You are an award-winning commercial director + DP (Cannes Lions / Super Bowl calibre) storyboarding a premium ${opts.sceneShots}-scene hero commercial from this ad.
First silently lock a PRODUCTION BIBLE from the image: the exact HERO PRODUCT (form, label, branding), any CHARACTER (look/wardrobe), the brand, palette and mood. These MUST stay identical across every shot.
Then write a ${opts.sceneShots}-shot cinematic storyboard that builds a real ad arc (hook → product beauty → benefit/lifestyle), each shot ~${opts.shotDuration}s. (A closing brand end-card using the original ad is added separately — do NOT include it.)

For EACH shot return:
- "keyframe_prompt": a detailed IMAGE prompt for that shot's first frame — a distinct, gorgeous cinematic scene that FEATURES THE EXACT PRODUCT from the reference (same form/label), photoreal commercial photography, specific lighting + composition. Do NOT put ad headlines/logos/CTA text in these scenes (they are film frames, not posters).
- "motion_prompt": how Kling animates that frame — ONE deliberate camera move (dolly/push-in/crane/orbit/tracking/parallax), lens/optics (focal length, shallow DoF, rack-focus), realistic subject motion & physics (splash, steam, drift, fabric), lighting evolution, colour grade, pacing/emotion, and tasteful audio (ambience/foley/music vibe). Explicitly keep the product, label and any text stable and undistorted.
- "summary": max 6 words.

Also return a short "bible" (1-2 sentences naming the product + look) and a tuned "negative_prompt".
${opts.brief ? `\nClient brief to honour across the commercial: ${opts.brief}` : ""}
Return STRICT JSON only: {"bible":"...","negative_prompt":"...","shots":[{"keyframe_prompt":"...","motion_prompt":"...","summary":"..."}]} with exactly ${opts.sceneShots} shots.`;

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
      negative_prompt: string;
      shots: Array<Partial<Shot> & { keyframe_prompt?: string; motion_prompt?: string }>;
    }>;
    const shots = (p.shots ?? [])
      .map((s) => ({
        keyframePrompt: (s.keyframe_prompt ?? s.keyframePrompt ?? "").trim(),
        motionPrompt: (s.motion_prompt ?? s.motionPrompt ?? "").trim(),
        summary: (s.summary ?? "").trim() || "Scene",
      }))
      .filter((s) => s.keyframePrompt && s.motionPrompt)
      .slice(0, opts.sceneShots);
    if (!shots.length) return fallback;
    return {
      bible: p.bible?.trim() || fallback.bible,
      negativePrompt: p.negative_prompt?.trim() || DEFAULT_NEGATIVE,
      shots,
    };
  } catch (e) {
    console.error("[ai-ads] buildStoryboard failed (non-fatal):", e);
    return fallback;
  }
}
