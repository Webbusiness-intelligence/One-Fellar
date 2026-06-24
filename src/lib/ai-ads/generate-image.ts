// Image generation models, all via the fal aggregator.
//
//  - Bria Product Shot: places the product into a generated background while
//    STRICTLY preserving it. Commercially licensed → safest, highest fidelity.
//  - Seedream / Nano Banana / FLUX Kontext / GPT Image: editing models that
//    take the product as a reference image and composite it into the scene via
//    a text instruction. More striking scenes; size handled per-model below.

import { falRun } from "./fal";

// Target pixel dimensions for every supported aspect ratio. The generate route
// also normalises each output to these exact dims, so this is the source of
// truth for "what size is a 9:16 ad".
export const FORMAT_DIMS: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "4:5": [1024, 1280],
  "9:16": [768, 1344],
  "16:9": [1344, 768],
  "4:3": [1184, 888],
  "3:4": [888, 1184],
  "3:2": [1216, 832],
  "2:3": [832, 1216],
  "21:9": [1536, 656],
};

export const FORMAT_IDS = Object.keys(FORMAT_DIMS);

// Aspect-ratio enums accepted by the aspect-based models. For a format a model
// doesn't list, we snap to the closest ratio it does support.
const NANO_RATIOS = ["1:1", "4:5", "5:4", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
const KONTEXT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

function dims(format: string): [number, number] {
  return FORMAT_DIMS[format] ?? [1024, 1024];
}

function nearestAspect(format: string, supported: string[]): string {
  const [w, h] = dims(format);
  const target = w / h;
  let best = supported[0];
  let bestDelta = Infinity;
  for (const s of supported) {
    const [a, b] = s.split(":").map(Number);
    const delta = Math.abs(a / b - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

// GPT Image only supports three sizes; pick by orientation.
function gptSize(format: string): string {
  const [w, h] = dims(format);
  if (Math.abs(w - h) / Math.max(w, h) < 0.1) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

function editPrompt(scene: string): string {
  return `Place the product from the reference image into a new scene: ${scene} Photorealistic product advertisement with professional studio lighting and composition. CRITICAL: reproduce the product EXACTLY as it appears in the reference — identical shape, proportions, colour, material, and the exact existing label and text. Do NOT add, invent, redraw, or change any logo, text, lettering, graphic, symbol, branding, or decoration on the product or its packaging. If the reference shows no logo, the result must show no logo. Only generate the surrounding background, surface, and lighting.`;
}

type RunOpts = { imageUrl: string; scene: string; format: string };

export async function productShot(opts: RunOpts): Promise<string[]> {
  const data = await falRun<{ images?: Array<{ url: string }> }>("fal-ai/bria/product-shot", {
    image_url: opts.imageUrl,
    scene_description: opts.scene,
    optimize_description: true,
    placement_type: "original",
    shot_size: dims(opts.format),
    num_results: 1,
  });
  return (data.images ?? []).map((i) => i.url);
}

export async function seedreamShot(opts: RunOpts): Promise<string[]> {
  const [width, height] = dims(opts.format);
  const data = await falRun<{ images?: Array<{ url: string }> }>(
    "fal-ai/bytedance/seedream/v4/edit",
    {
      prompt: editPrompt(opts.scene),
      image_urls: [opts.imageUrl],
      image_size: { width, height },
      num_images: 1,
    },
  );
  return (data.images ?? []).map((i) => i.url);
}

export async function nanoBananaShot(opts: RunOpts): Promise<string[]> {
  const data = await falRun<{ images?: Array<{ url: string }> }>("fal-ai/nano-banana/edit", {
    prompt: editPrompt(opts.scene),
    image_urls: [opts.imageUrl],
    aspect_ratio: nearestAspect(opts.format, NANO_RATIOS),
    num_images: 1,
  });
  return (data.images ?? []).map((i) => i.url);
}

export async function fluxKontextShot(opts: RunOpts): Promise<string[]> {
  const data = await falRun<{ images?: Array<{ url: string }> }>("fal-ai/flux-pro/kontext", {
    prompt: editPrompt(opts.scene),
    image_url: opts.imageUrl,
    aspect_ratio: nearestAspect(opts.format, KONTEXT_RATIOS),
  });
  return (data.images ?? []).map((i) => i.url);
}

export async function gptImageShot(opts: RunOpts): Promise<string[]> {
  const data = await falRun<{ images?: Array<{ url: string }> }>("fal-ai/gpt-image-1/edit-image", {
    prompt: editPrompt(opts.scene),
    image_urls: [opts.imageUrl],
    image_size: gptSize(opts.format),
  });
  return (data.images ?? []).map((i) => i.url);
}

// Registry used by the per-generation model picker.
export type AdModelId = "bria" | "nano-banana" | "seedream" | "flux-kontext" | "gpt-image";

type AdModel = { id: AdModelId; label: string; run: (opts: RunOpts) => Promise<string[]> };

export const AD_MODELS: AdModel[] = [
  { id: "seedream", label: "Seedream 4", run: seedreamShot },
  { id: "nano-banana", label: "Nano Banana", run: nanoBananaShot },
  { id: "flux-kontext", label: "FLUX Kontext", run: fluxKontextShot },
  { id: "gpt-image", label: "GPT Image", run: gptImageShot },
  { id: "bria", label: "Bria — fidelity", run: productShot },
];

// A faster curated subset (3) for the side-by-side "Compare" flow.
export const COMPARE_MODELS: AdModel[] = AD_MODELS.filter((m) =>
  ["seedream", "nano-banana", "bria"].includes(m.id),
);
