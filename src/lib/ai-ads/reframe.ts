// Reframe / extend: intelligently outpaints an existing image to a NEW aspect
// ratio (one hero shot → every platform size) via Ideogram reframe. Returns null
// on failure so callers can surface an error.

import { falRun } from "./fal";
import { FORMAT_DIMS } from "./generate-image";

export async function reframeImage(url: string, format: string): Promise<string | null> {
  const [width, height] = FORMAT_DIMS[format] ?? [1024, 1024];
  try {
    const data = await falRun<{ images?: Array<{ url: string }> }>(
      "fal-ai/ideogram/v3/reframe",
      { image_url: url, image_size: { width, height } },
      90000,
    );
    return data.images?.[0]?.url ?? null;
  } catch (e) {
    console.error("[ai-ads] reframe failed:", e);
    return null;
  }
}
