// Soul-ID candidate generation, in the background. Reads the brief, generates N
// candidate images with gpt-image (kind-specific reference-sheet prompt), uploads
// each to storage and attaches them as ad_assets to the job — so they survive
// navigation/refresh and can be picked + saved later from the Soul page.
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { FAL, toCredits } from "@/lib/ai-ads/cost";
import { admin, BUCKET, insertAsset, setProgress, type Job } from "./db";

type GptModel = "gpt-image-1.5" | "gpt-image-2";
type GptQuality = "low" | "medium" | "high";

type Brief = {
  description?: string;
  kind?: string;
  count?: number;
  model?: string;
  quality?: string;
  refUrls?: string[];
};

// Kind-specific reference-sheet prompt (kept in sync with the Soul API route).
function soulSheetPrompt(kind: string, desc: string, hasRef: boolean): { prompt: string; format: string } {
  const ref = hasRef
    ? " Reproduce the subject in the reference image EXACTLY (same identity, form, colours, label, proportions); do not restyle or replace it."
    : "";
  switch (kind) {
    case "product":
      return {
        format: "1:1",
        prompt: `Technical PRODUCT reference sheet of ${desc}, shown in four views in a clean 2x2 grid — front, back, top-down, and 3/4 angle — isolated on a neutral light-grey background, sharp even studio lighting, photorealistic materials and textures, ultra high resolution. Thin grey dividers between views only. NO text, NO labels, NO callouts.${ref}`,
      };
    case "character":
      return {
        format: "16:9",
        prompt: `CHARACTER reference sheet: two panels side by side on a neutral grey studio background — LEFT a full-body standing view, RIGHT a head-and-shoulders close-up — of ${desc}. Identical identity, face, hair and wardrobe across both panels, photorealistic, soft even studio light, 35mm film look. NO text, NO labels.${ref}`,
      };
    case "location":
      return {
        format: "16:9",
        prompt: `Cinematic LOCATION plate: an empty establishing wide shot of ${desc}. Anamorphic lens look, fine film grain, premium colour grade, deep focus, generous negative space. NO people, NO product, NO text — just the environment, ready to place subjects into.${ref}`,
      };
    case "style":
      return {
        format: "1:1",
        prompt: `A STYLE / mood board that captures the visual language of ${desc} — colour palette, lighting, texture and composition cues arranged as a cohesive reference. Photoreal where relevant, premium art direction. NO text, NO labels, NO watermarks.${ref}`,
      };
    case "logo":
      return {
        format: "1:1",
        prompt: `The logo / graphic of ${desc}, presented EXACTLY as a clean, flat 2D graphic — centered and isolated on a plain neutral white background, crisp and high-resolution, true to its shapes, colours and proportions. NOT a person, NOT a 3D object, NOT a scene, NOT a mockup, NO hands, NO props — just the graphic itself.${ref}`,
      };
    default:
      return {
        format: "1:1",
        prompt: `PROP reference of ${desc}, shown from a few clean angles, isolated on a neutral grey background, photorealistic, sharp studio lighting, high detail. NO text, NO labels.${ref}`,
      };
  }
}

export async function runSoulJob(job: Job): Promise<number> {
  const b = (job.brief ?? {}) as Brief;
  const description = String(b.description ?? "").trim();
  if (!description) throw new Error("Describe what to create");
  const kind = String(b.kind ?? "character");
  const count = Math.min(Math.max(Number(b.count) || 1, 1), 6);
  const model: GptModel = b.model === "gpt-image-2" ? "gpt-image-2" : "gpt-image-1.5";
  const quality: GptQuality = (["low", "medium", "high"] as const).includes(b.quality as GptQuality)
    ? (b.quality as GptQuality)
    : "high";
  const refUrls = Array.isArray(b.refUrls) ? b.refUrls.filter((x) => typeof x === "string") : [];

  await setProgress(job.id, "generating");
  const { prompt, format } = soulSheetPrompt(kind, description, refUrls.length > 0);
  const gen = (m: GptModel) =>
    refUrls.length
      ? gptImageEdit({ prompt, imageUrls: refUrls, format, quality, num: count, model: m })
      : gptImageGenerate({ prompt, format, quality, num: count, model: m });

  // Reliability: retry transient fal failures (5xx / timeout / rate-limit / empty)
  // with backoff, then fall back to gpt-image-1.5 if -2 keeps failing. If it still
  // fails, surface the REAL error (e.g. a content-policy refusal) so it's actionable
  // rather than a generic "couldn't generate".
  const models: GptModel[] = model === "gpt-image-2" ? ["gpt-image-2", "gpt-image-1.5"] : ["gpt-image-1.5"];
  let outs: string[] = [];
  let lastErr = "";
  for (const m of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await gen(m);
        if (r.length) {
          outs = r;
          break;
        }
        lastErr = "the model returned no image";
      } catch (e) {
        lastErr = String((e as Error)?.message ?? e);
        console.error(`[worker] soul gen ${m} attempt ${attempt + 1}:`, lastErr);
      }
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
    if (outs.length) break;
  }
  if (!outs.length) throw new Error(lastErr || "Couldn't generate that — try again");

  let made = 0;
  for (let i = 0; i < outs.length; i++) {
    const bytes = new Uint8Array(await (await fetch(outs[i])).arrayBuffer());
    const path = `soul-candidates/${job.account_id}/${job.id}/${i}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) continue;
    const id = await insertAsset(job, {
      type: "image",
      storagePath: path,
      variationIndex: i,
      metadata: { soulCandidate: true, kind, description, summary: description.slice(0, 80) },
    });
    if (id) made++;
  }
  if (!made) throw new Error("Couldn't store candidates");

  const per = quality === "high" ? FAL.gptImageHigh : quality === "medium" ? FAL.gptImageMedium : FAL.gptImageLow;
  console.log(`[worker] soul ${kind} | ${made}/${count} candidates`);
  return toCredits(made * per);
}
