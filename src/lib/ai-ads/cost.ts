// Credits = an exact linear conversion of real fal spend. 1 credit = $0.01.
// The per-action estimators below sum the ACTUAL fal calls each generation makes
// (model + extras like best-of-N, upscale, backdrop), so the credit number on a
// button reflects exactly what that generation costs us on fal.

export const CREDIT_USD = 0.01; // $0.01 per credit
export const toCredits = (usd: number) => Math.max(1, Math.round(usd / CREDIT_USD));
export const MONTHLY_BUDGET_CREDITS = 5000; // = $50

// Real per-call fal prices (USD) for the models/ops we use.
export const FAL = {
  nanoBanana: 0.039,
  nanoBananaPro: 0.139,
  nanoBananaEdit: 0.039,
  nanoBananaProEdit: 0.139,
  recraft: 0.04,
  ideogram: 0.08,
  ideogramReframe: 0.08,
  imagen4Ultra: 0.06,
  fluxPro: 0.06,
  fluxSchnell: 0.003,
  briaProduct: 0.04,
  briaBgRemove: 0.04,
  seedream: 0.03,
  gptImage: 0.02,
  // OpenAI GPT image via fal (portrait + reference inputs included).
  gptImageLow: 0.02, // low output + low-fidelity input
  gptImageMedium: 0.1,
  gptImageHigh: 0.25,
  // Kling v3 Pro image-to-video, per second of output.
  klingVideoSec: 0.112, // audio off
  klingVideoSecAudio: 0.168, // audio on
  // Commercial-mode engines, per second of output.
  klingTurboSec: 0.07, // Kling 2.5 Turbo
  seedanceProSec: 0.3024, // Seedance 2.0 standard/pro
  seedanceFastSec: 0.2419, // Seedance 2.0 fast
  clarityUpscale: 0.05,
  geminiText: 0.0006, // director / router / copy / enhancer
  geminiVision: 0.0016, // a QA / evaluator vision score
};

// Per-image cost for a registry model id (chat single + quick ads).
export function modelUsd(model: string): number {
  switch (model) {
    case "nano-banana":
      return FAL.nanoBanana;
    case "nano-banana-pro":
      return FAL.nanoBananaPro;
    case "recraft":
      return FAL.recraft;
    case "ideogram":
      return FAL.ideogram;
    case "imagen4-ultra":
      return FAL.imagen4Ultra;
    case "flux-pro":
      return FAL.fluxPro;
    case "bria":
      return FAL.briaProduct;
    case "seedream":
      return FAL.seedream;
    case "gpt-image":
      return FAL.gptImage;
    case "locked":
      return FAL.fluxSchnell;
    default:
      return FAL.nanoBanana;
  }
}

// GPT image per-image price for our quality tiers: Standard→low, HD→medium, Best→high.
export function gptImageUsd(quality: "standard" | "hd" | "best"): number {
  return quality === "standard"
    ? FAL.gptImageLow
    : quality === "hd"
      ? FAL.gptImageMedium
      : FAL.gptImageHigh;
}

// ---- Per-action estimators (used by buttons AND routes, kept identical) ----

export function chatCostUsd(o: {
  variations: number;
  quality: "standard" | "hd" | "best";
  isEdit: boolean;
  model?: string;
  engine?: "nano" | "gpt";
}): number {
  if (o.engine === "gpt") {
    // GPT image returns num_images in one call; price scales per image by quality.
    const per = gptImageUsd(o.quality);
    return Math.max(1, Math.min(o.variations, 8)) * per + FAL.geminiText;
  }
  if (o.isEdit) return FAL.nanoBananaEdit + FAL.geminiText; // edit / style / compose
  if (o.variations > 1) return o.variations * FAL.nanoBanana + FAL.geminiText; // batch (fast model)
  if (o.quality === "hd") return FAL.imagen4Ultra + FAL.clarityUpscale + FAL.geminiText;
  if (o.quality === "best")
    return 3 * FAL.imagen4Ultra + 3 * FAL.geminiVision + FAL.clarityUpscale + FAL.geminiText;
  return modelUsd(o.model ?? "nano-banana") + FAL.geminiText; // standard single
}

export function posterCostUsd(o: {
  count: number;
  backdrop: boolean;
  quality: "standard" | "hd" | "best";
}): number {
  // GPT image returns `count` posters in one call; +imagen backdrop if requested.
  return (
    o.count * gptImageUsd(o.quality) + (o.backdrop ? FAL.imagen4Ultra : 0) + FAL.geminiText
  );
}

export function quickCostUsd(o: { count: number; model: string; allSizes: boolean }): number {
  if (o.model === "compare")
    return FAL.briaProduct + FAL.nanoBanana + FAL.seedream + FAL.geminiText; // 3 compare models
  const n = o.allSizes ? 3 : o.count;
  const evalCost = o.model === "locked" ? 0 : n * FAL.geminiVision; // evaluator runs on non-locked
  return n * modelUsd(o.model) + evalCost + FAL.geminiText;
}

export function videoCostUsd(o: { duration: number; audio?: boolean }): number {
  const per = o.audio === false ? FAL.klingVideoSec : FAL.klingVideoSecAudio;
  return o.duration * per + FAL.geminiVision; // + director vision pass
}

export function commercialCostUsd(o: { sceneShots: number; shotDuration: number }): number {
  const totalShots = o.sceneShots + 1; // scenes + brand end-card (the original ad)
  return (
    o.sceneShots * FAL.gptImageMedium + // keyframes
    totalShots * o.shotDuration * FAL.klingVideoSecAudio + // kling per shot, audio on
    FAL.geminiVision // storyboard vision pass
  );
}

// Commercial-mode video engines → USD per second of output.
export const VIDEO_ENGINE_SEC: Record<string, number> = {
  "kling-pro": FAL.klingVideoSecAudio,
  "kling-turbo": FAL.klingTurboSec,
  "seedance-pro": FAL.seedanceProSec,
  "seedance-fast": FAL.seedanceFastSec,
};
// Credits to render one scene: N takes × duration × engine/sec + a keyframe (gpt med).
export function sceneCredits(o: { duration: number; takes: number; engine: string }): number {
  const per = VIDEO_ENGINE_SEC[o.engine] ?? FAL.klingVideoSecAudio;
  return toCredits(o.takes * o.duration * per + FAL.gptImageMedium);
}

export const chatCredits = (o: Parameters<typeof chatCostUsd>[0]) => toCredits(chatCostUsd(o));
export const videoCredits = (o: Parameters<typeof videoCostUsd>[0]) => toCredits(videoCostUsd(o));
export const commercialCredits = (o: Parameters<typeof commercialCostUsd>[0]) =>
  toCredits(commercialCostUsd(o));
export const posterCredits = (o: Parameters<typeof posterCostUsd>[0]) => toCredits(posterCostUsd(o));
export const quickCredits = (o: Parameters<typeof quickCostUsd>[0]) => toCredits(quickCostUsd(o));

// Per stored-asset cost for the running usage meter (reflects each pipeline).
const ASSET_USD: Record<string, number> = {
  "nano-banana": 0.04,
  "nano-banana-pro": 0.139,
  "nano-banana-edit": 0.04,
  recraft: 0.04,
  ideogram: 0.08,
  "imagen4-ultra": 0.16,
  "flux-pro": 0.06,
  bria: 0.04,
  seedream: 0.03,
  "gpt-image": 0.02,
  "gpt-image-1.5": 0.25,
  video: 1.68,
  poster: 0.25,
  compare: 0.11,
  reframe: 0.08,
  cutout: 0.04,
  locked: 0.03,
  compose: 0,
};
export function assetCredits(model: string | null | undefined): number {
  const usd = model && model in ASSET_USD ? ASSET_USD[model] : 0.05;
  return usd / CREDIT_USD; // keep fractional; round on totals
}
