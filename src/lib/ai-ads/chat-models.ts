// Generic (non-product-specific) image runners for the conversational studio.
// Unlike generate-image.ts these pass the user's prompt through as-is.

import { falRun } from "./fal";
import { FORMAT_DIMS } from "./generate-image";

export type ChatModelId =
  | "nano-banana"
  | "nano-banana-pro"
  | "recraft"
  | "ideogram"
  | "imagen4-ultra"
  | "flux-pro";

type FalImages = { images?: Array<{ url: string }>; image?: { url: string } };

function urls(d: FalImages): string[] {
  if (d.images?.length) return d.images.map((i) => i.url);
  if (d.image?.url) return [d.image.url];
  return [];
}

// Hero (text-to-image) models for premium quality use aspect-ratio enums.
const IMAGEN_RATIOS = ["1:1", "16:9", "9:16", "3:4", "4:3"];
const FLUXPRO_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
function nearestRatio(format: string, supported: string[]): string {
  const [w, h] = FORMAT_DIMS[format] ?? [1, 1];
  const target = w / h;
  let best = supported[0];
  let bd = Infinity;
  for (const s of supported) {
    const [a, b] = s.split(":").map(Number);
    const d = Math.abs(a / b - target);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// Text-to-image: make a fresh image from a prompt.
export async function chatGenerate(opts: {
  prompt: string;
  format: string;
  model: ChatModelId;
}): Promise<string[]> {
  const { prompt, format, model } = opts;
  const [width, height] = FORMAT_DIMS[format] ?? [1024, 1024];

  if (model === "recraft") {
    return urls(
      await falRun<FalImages>("fal-ai/recraft/v3/text-to-image", {
        prompt,
        image_size: { width, height },
      }),
    );
  }
  if (model === "ideogram") {
    return urls(
      await falRun<FalImages>("fal-ai/ideogram/v3", {
        prompt,
        image_size: { width, height },
      }),
    );
  }
  if (model === "imagen4-ultra") {
    return urls(
      await falRun<FalImages>("fal-ai/imagen4/preview/ultra", {
        prompt,
        aspect_ratio: nearestRatio(format, IMAGEN_RATIOS),
      }),
    );
  }
  if (model === "flux-pro") {
    return urls(
      await falRun<FalImages>("fal-ai/flux-pro/v1.1-ultra", {
        prompt,
        aspect_ratio: nearestRatio(format, FLUXPRO_RATIOS),
      }),
    );
  }
  const id = model === "nano-banana-pro" ? "fal-ai/nano-banana-pro" : "fal-ai/nano-banana";
  return urls(await falRun<FalImages>(id, { prompt, aspect_ratio: format, num_images: 1 }));
}

// Premium poster: nano-banana-pro (best text) edits the product+logo refs into a
// fully designed poster; falls back to text-to-image when there are no refs.
export async function posterShot(opts: {
  prompt: string;
  imageUrls: string[];
  format: string;
}): Promise<string[]> {
  if (opts.imageUrls.length) {
    return urls(
      await falRun<FalImages>(
        "fal-ai/nano-banana-pro/edit",
        { prompt: opts.prompt, image_urls: opts.imageUrls, aspect_ratio: opts.format, num_images: 1 },
        90000,
      ),
    );
  }
  return urls(
    await falRun<FalImages>(
      "fal-ai/nano-banana-pro",
      { prompt: opts.prompt, aspect_ratio: opts.format, num_images: 1 },
      90000,
    ),
  );
}

// OpenAI GPT image (via fal, billed on FAL_KEY) — best at full ad LAYOUTS + crisp
// text. Maps our format to gpt-image's fixed sizes.
function gptSize(format: string): string {
  const [w, h] = FORMAT_DIMS[format] ?? [1, 1];
  if (Math.abs(w / h - 1) < 0.12) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

export type GptImageModel = "gpt-image-1.5" | "gpt-image-2";

export async function gptImageEdit(opts: {
  prompt: string;
  imageUrls: string[];
  format: string;
  quality?: "low" | "medium" | "high";
  num?: number;
  model?: GptImageModel;
}): Promise<string[]> {
  const isV2 = opts.model === "gpt-image-2";
  const [w, h] = gptSize(opts.format).split("x").map(Number);
  return urls(
    await falRun<FalImages>(
      isV2 ? "openai/gpt-image-2/edit" : "fal-ai/gpt-image-1.5/edit",
      {
        prompt: opts.prompt,
        image_urls: opts.imageUrls,
        image_size: isV2 ? { width: w, height: h } : gptSize(opts.format),
        quality: opts.quality ?? "high",
        num_images: opts.num ?? 1,
        // input_fidelity is a gpt-image-1.5 param; gpt-image-2 doesn't take it.
        ...(isV2
          ? {}
          : { input_fidelity: (opts.quality ?? "high") === "low" ? "low" : "high" }),
        output_format: "png",
      },
      180000,
    ),
  );
}

export async function gptImageGenerate(opts: {
  prompt: string;
  format: string;
  quality?: "low" | "medium" | "high";
  num?: number;
  model?: GptImageModel;
}): Promise<string[]> {
  const isV2 = opts.model === "gpt-image-2";
  const [w, h] = gptSize(opts.format).split("x").map(Number);
  return urls(
    await falRun<FalImages>(
      isV2 ? "openai/gpt-image-2" : "fal-ai/gpt-image-1.5",
      {
        prompt: opts.prompt,
        image_size: isV2 ? { width: w, height: h } : gptSize(opts.format),
        quality: opts.quality ?? "high",
        num_images: opts.num ?? 1,
        output_format: "png",
      },
      180000,
    ),
  );
}

// Conversational edit: change one or more reference images per the instruction.
export async function chatEdit(opts: {
  prompt: string;
  imageUrls: string[];
  format: string;
  pro?: boolean;
}): Promise<string[]> {
  const id = opts.pro ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana/edit";
  return urls(
    await falRun<FalImages>(
      id,
      {
        prompt: opts.prompt,
        image_urls: opts.imageUrls,
        aspect_ratio: opts.format,
        num_images: 1,
      },
      opts.pro ? 90000 : 75000,
    ),
  );
}
