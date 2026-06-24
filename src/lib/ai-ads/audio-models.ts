// Audio runners (via fal, billed on FAL_KEY): music bed + text-to-speech (VO) +
// talking-avatar (image + audio → lip-synced video). Server-only.

import { falRun, falQueue } from "./fal";

type MusicOut = { audio_file?: { url?: string } };
type TtsOut = { audio?: { url?: string } };
type AvatarOut = { video?: { url?: string } };

// CassetteAI music — fast text-to-music with a duration (seconds).
export async function generateMusic(opts: { prompt: string; duration: number }): Promise<string | null> {
  const out = await falRun<MusicOut>(
    "CassetteAI/music-generator",
    { prompt: opts.prompt, duration: Math.min(Math.max(Math.round(opts.duration), 5), 180) },
    180000,
  );
  return out.audio_file?.url ?? null;
}

// Gemini TTS — premium voiceover with a voice preset + style guidance.
export async function textToSpeech(opts: {
  text: string;
  voice?: string;
  style?: string;
}): Promise<string | null> {
  const out = await falRun<TtsOut>(
    "fal-ai/gemini-tts",
    {
      prompt: opts.text,
      voice: opts.voice || "Charon",
      ...(opts.style ? { style_instructions: opts.style } : {}),
      output_format: "mp3",
    },
    120000,
  );
  return out.audio?.url ?? null;
}

// Kling AI Avatar — drive a portrait with audio to get a lip-synced talking clip.
export async function talkingAvatar(opts: {
  imageUrl: string;
  audioUrl: string;
  prompt?: string;
}): Promise<string | null> {
  const out = await falQueue<AvatarOut>(
    "fal-ai/kling-video/ai-avatar/v2/pro",
    { image_url: opts.imageUrl, audio_url: opts.audioUrl, ...(opts.prompt ? { prompt: opts.prompt } : {}) },
    { pollMs: 6000, timeoutMs: 600000 },
  );
  return out.video?.url ?? null;
}
