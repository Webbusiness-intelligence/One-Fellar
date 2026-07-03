// Video runners (via fal queue, billed on FAL_KEY). We support four engines:
//   kling-pro   = Kling v3 Pro      (top quality, native audio, 3/5/10/15s)
//   kling-turbo = Kling 2.5 Turbo   (fast/value, 5/10s)
//   seedance-pro / seedance-fast = ByteDance Seedance 2.0 (cinematic, auto-duration, audio)

import { falQueue } from "./fal";
import { arkSeedanceEnabled, arkSeedanceVideo } from "./ark-video";

export type VideoEngine = "kling-pro" | "kling-turbo" | "seedance-pro" | "seedance-fast";

type VideoOut = { video?: { url?: string } };

const Q = { pollMs: 6000, timeoutMs: 1200000 } as const; // 20 min ceiling — 4K/15s reference renders can exceed 10
const DEFAULT_NEG = "blur, distort, and low quality";

export async function klingImageToVideo(opts: {
  startImageUrl: string;
  prompt: string;
  negativePrompt?: string;
  duration: number; // 3 | 5 | 10 | 15
  audio?: boolean;
  endImageUrl?: string;
}): Promise<string | null> {
  const out = await falQueue<VideoOut>(
    "fal-ai/kling-video/v3/pro/image-to-video",
    {
      start_image_url: opts.startImageUrl,
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt ?? DEFAULT_NEG,
      duration: String(opts.duration),
      generate_audio: opts.audio !== false,
      ...(opts.endImageUrl ? { end_image_url: opts.endImageUrl } : {}),
    },
    Q,
  );
  return out.video?.url ?? null;
}

export async function klingTurboImageToVideo(opts: {
  startImageUrl: string;
  prompt: string;
  negativePrompt?: string;
  duration: number; // turbo supports 5 | 10
  endImageUrl?: string;
}): Promise<string | null> {
  const out = await falQueue<VideoOut>(
    "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    {
      image_url: opts.startImageUrl,
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt ?? DEFAULT_NEG,
      duration: opts.duration >= 10 ? "10" : "5",
      ...(opts.endImageUrl ? { tail_image_url: opts.endImageUrl } : {}),
    },
    Q,
  );
  return out.video?.url ?? null;
}

export async function seedanceImageToVideo(opts: {
  startImageUrl: string;
  prompt: string;
  duration: number; // 4-15
  audio?: boolean;
  endImageUrl?: string;
  fast?: boolean;
  resolution?: string; // 480p | 720p | 1080p | 4k
  bitrate?: string; // standard | high
}): Promise<string | null> {
  // Ark-direct (opt-in) — cheaper than fal for the same model, incl. native 4K.
  // Falls back to fal on any Ark error (e.g. Seedance's real-person content block,
  // which fal doesn't enforce), so a clip always renders.
  if (arkSeedanceEnabled()) {
    try {
      return await arkSeedanceVideo({
        prompt: opts.prompt,
        duration: opts.duration,
        resolution: opts.resolution,
        audio: opts.audio,
        fast: opts.fast,
        firstFrameUrl: opts.startImageUrl,
        lastFrameUrl: opts.endImageUrl,
      });
    } catch (e) {
      console.warn(`[ark] image-to-video failed → falling back to fal: ${(e as Error)?.message ?? e}`);
    }
  }
  const out = await falQueue<VideoOut>(
    opts.fast ? "bytedance/seedance-2.0/fast/image-to-video" : "bytedance/seedance-2.0/image-to-video",
    {
      image_url: opts.startImageUrl,
      prompt: opts.prompt,
      duration: Math.min(Math.max(opts.duration, 4), 15),
      resolution: opts.resolution ?? "720p",
      generate_audio: opts.audio !== false,
      bitrate_mode: opts.bitrate ?? "standard",
      ...(opts.endImageUrl ? { end_image_url: opts.endImageUrl } : {}),
    },
    Q,
  );
  return out.video?.url ?? null;
}

// Seedance 2.0 REFERENCE-to-video: natively seeds up to 9 reference images and
// binds each to the prompt via @Image1, @Image2 … tags (how Higgsfield does
// multi-subject). No start frame — references + prompt drive the whole clip.
export async function seedanceReferenceToVideo(opts: {
  imageUrls: string[];
  prompt: string;
  duration: number; // 4-15
  audio?: boolean;
  resolution?: string;
  fast?: boolean;
  bitrate?: string; // standard | high
}): Promise<string | null> {
  // Ark-direct (opt-in) — falls back to fal on any Ark error (e.g. Seedance's
  // real-person content block), so a clip always renders.
  if (arkSeedanceEnabled()) {
    try {
      return await arkSeedanceVideo({
        prompt: opts.prompt,
        duration: opts.duration,
        resolution: opts.resolution,
        audio: opts.audio,
        fast: opts.fast,
        referenceUrls: opts.imageUrls,
      });
    } catch (e) {
      console.warn(`[ark] reference-to-video failed → falling back to fal: ${(e as Error)?.message ?? e}`);
    }
  }
  const out = await falQueue<VideoOut>(
    opts.fast
      ? "bytedance/seedance-2.0/fast/reference-to-video"
      : "bytedance/seedance-2.0/reference-to-video",
    {
      prompt: opts.prompt,
      image_urls: opts.imageUrls.slice(0, 9),
      duration: String(Math.min(Math.max(opts.duration, 4), 15)),
      resolution: opts.resolution ?? "720p",
      generate_audio: opts.audio !== false,
      bitrate_mode: opts.bitrate ?? "standard",
    },
    Q,
  );
  return out.video?.url ?? null;
}

// Seedance TEXT-to-video — no input image, so the subject is generated from the
// prompt. On Ark this avoids Seedance's "real person" image block entirely (and still
// renders native 4K). Falls back to fal text-to-video only on a genuine Ark error.
export async function seedanceTextToVideo(opts: {
  prompt: string;
  duration: number;
  resolution?: string;
  audio?: boolean;
  fast?: boolean;
}): Promise<string | null> {
  if (arkSeedanceEnabled()) {
    try {
      return await arkSeedanceVideo({
        prompt: opts.prompt,
        duration: opts.duration,
        resolution: opts.resolution,
        audio: opts.audio,
        fast: opts.fast,
      });
    } catch (e) {
      console.warn(`[ark] text-to-video failed → falling back to fal: ${(e as Error)?.message ?? e}`);
    }
  }
  const out = await falQueue<VideoOut>(
    opts.fast ? "bytedance/seedance-2.0/fast/text-to-video" : "bytedance/seedance-2.0/text-to-video",
    {
      prompt: opts.prompt,
      duration: String(Math.min(Math.max(opts.duration, 4), 15)),
      resolution: opts.resolution ?? "720p",
      generate_audio: opts.audio !== false,
    },
    Q,
  );
  return out.video?.url ?? null;
}

// Dispatch a scene render to the chosen engine.
export function renderSceneVideo(
  engine: VideoEngine,
  opts: {
    startImageUrl: string;
    prompt: string;
    negativePrompt?: string;
    duration: number;
    audio?: boolean;
    resolution?: string; // seedance only (480p|720p|1080p|4k); kling ignores
    bitrate?: string; // seedance only (standard|high); kling ignores
  },
): Promise<string | null> {
  if (engine === "kling-turbo") return klingTurboImageToVideo(opts); // no audio/resolution
  if (engine === "seedance-pro") return seedanceImageToVideo(opts);
  if (engine === "seedance-fast") return seedanceImageToVideo({ ...opts, fast: true });
  return klingImageToVideo(opts); // kling-pro (audio supported, native resolution)
}
