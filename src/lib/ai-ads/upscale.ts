// Generative upscaler (clarity) — the 2-pass "premium finish": takes a generated
// image URL and returns a crisp, higher-resolution, texture-rich version.
// Returns null on failure so callers can fall back to the original.

import { falRun } from "./fal";

export async function upscaleImage(url: string): Promise<string | null> {
  try {
    const data = await falRun<{ image?: { url: string } }>(
      "fal-ai/clarity-upscaler",
      { image_url: url, upscale_factor: 2 },
      90000,
    );
    return data.image?.url ?? null;
  } catch (e) {
    console.error("[ai-ads] upscale failed (non-fatal):", e);
    return null;
  }
}
