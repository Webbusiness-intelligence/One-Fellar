// Video runners (via fal queue, billed on FAL_KEY). We support four engines:
//   kling-pro   = Kling v3 Pro      (top quality, native audio, 3/5/10/15s)
//   kling-turbo = Kling 2.5 Turbo   (fast/value, 5/10s)
//   seedance-pro / seedance-fast = ByteDance Seedance 2.0 (cinematic, auto-duration, audio)

import { falQueue } from "./fal";

export type VideoEngine = "kling-pro" | "kling-turbo" | "seedance-pro" | "seedance-fast";

type VideoOut = { video?: { url?: string } };

const Q = { pollMs: 6000, timeoutMs: 600000 } as const;
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
