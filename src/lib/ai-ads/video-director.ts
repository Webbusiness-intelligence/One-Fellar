// Video "director": vision-reads the ad (the start frame) and writes a single,
// long, high-end CINEMATIC motion prompt for Kling image-to-video — as if a
// billion-dollar production studio storyboarded the shot. It first understands the
// hero product / characters / brand so it keeps them consistent and stable, then
// directs camera, lens, lighting, colour, motion, physics, pacing, emotion and
// audio. Fail-open: returns a sensible default prompt on any error.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface VideoBrief {
  prompt: string;
  negativePrompt: string;
  summary: string; // short, human-readable shot summary for the UI
}

const DEFAULT_NEGATIVE =
  "warped or morphing product, distorted or changing logo, garbled or flickering text, label deformation, extra limbs, extra fingers, duplicated objects, face distortion, jitter, flicker, strobing, low quality, blur, artifacts, watermark";

export async function buildVideoBrief(opts: {
  imageUrl: string;
  brief?: string;
  duration: number;
}): Promise<VideoBrief> {
  const fallback: VideoBrief = {
    prompt: `Cinematic commercial shot animating the still. Slow, smooth dolly-in on the hero subject with a subtle parallax; gentle, photoreal ambient motion; shallow depth of field with a soft rack-focus onto the product; premium volumetric lighting; refined teal-and-orange colour grade; 85mm anamorphic look; elegant, high-end pacing over ${opts.duration} seconds. Keep the product, logo and all text perfectly stable, sharp and unchanged.`,
    negativePrompt: DEFAULT_NEGATIVE,
    summary: "Cinematic push-in on the hero subject",
  };
  if (!GEMINI_API_KEY) return fallback;

  let imagePart: { inline_data: { mime_type: string; data: string } } | null = null;
  try {
    const buf = Buffer.from(await (await fetch(opts.imageUrl)).arrayBuffer());
    imagePart = { inline_data: { mime_type: "image/png", data: buf.toString("base64") } };
  } catch {
    /* fall back to text-only direction */
  }

  const instruction = `You are an award-winning commercial film DIRECTOR + DP (Cannes Lions / Super Bowl calibre) writing the shot for a ${opts.duration}-second hero clip.
This still image IS the first frame — the video will be generated FROM it (image-to-video), so the scene, product, characters and composition already exist. Your job is to bring it to life with motion and cinematic craft, NOT to invent a different scene.

First, silently understand the frame: identify the HERO PRODUCT (its exact form, label and branding), any CHARACTERS (their look/wardrobe), the setting, palette, brand and any on-screen TEXT/logo. These must stay 100% consistent and undistorted as it moves.

Then write ONE single, richly detailed cinematic motion prompt (a flowing paragraph, ~120-180 words) that a top studio would shoot, covering:
- CAMERA MOVE: one deliberate, smooth move (e.g. slow dolly-in, push-in, crane up, orbit, tracking, gentle parallax, subtle handheld) — keep it elegant, not chaotic.
- LENS / OPTICS: focal length + look (e.g. 85mm prime or anamorphic), aperture/shallow depth of field, bokeh, tasteful lens flare, a rack-focus beat onto the product.
- SUBJECT MOTION & PHYSICS: what realistically moves and how (liquid/splash dynamics, condensation, steam, drifting particles, fabric, hair, light shimmer) — photoreal, slow-motion where premium.
- LIGHTING: how light evolves (motivated key, rim/back light, volumetric haze, god-rays, golden-hour glow, soft studio softbox), colour temperature.
- COLOUR SCIENCE: a deliberate grade (e.g. teal-and-orange, filmic Kodak-stock emulation), contrast and richness; fine film grain/texture.
- COMPOSITION & FRAMING: maintain the focal point and a balanced frame; product hero.
- PACING / EMOTION: the tempo and feeling over ${opts.duration}s (luxurious, energetic, serene…), building to a beat.
- AUDIO: ambient bed + tasteful foley/SFX (e.g. fizz, splash, whoosh) and a music vibe/tempo that fits — audio will be generated.
- STABILITY: explicitly keep the product, logo and every word of text perfectly stable, crisp, legible and unchanged throughout (no warping/morphing).
${opts.brief ? `\nClient brief to honour: ${opts.brief}` : ""}

Also write a tuned negative prompt and a short (max 8 words) human summary of the shot.
Return STRICT JSON only: {"prompt":"...","negative_prompt":"...","summary":"..."}`;

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
    const p = JSON.parse(raw) as Partial<{ prompt: string; negative_prompt: string; summary: string }>;
    return {
      prompt: p.prompt?.trim() || fallback.prompt,
      negativePrompt: p.negative_prompt?.trim() || DEFAULT_NEGATIVE,
      summary: p.summary?.trim() || fallback.summary,
    };
  } catch (e) {
    console.error("[ai-ads] buildVideoBrief failed (non-fatal):", e);
    return fallback;
  }
}
