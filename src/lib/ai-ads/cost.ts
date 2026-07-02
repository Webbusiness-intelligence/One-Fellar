// Credit = $0.01 of customer spend. The per-action estimators below sum the ACTUAL
// fal calls a generation makes; `toCredits` then marks that real cost up by MARGIN, so
// the credits CHARGED to a user are the sell price (cost × MARGIN), not raw cost. The
// internal cost meter (assetCredits, below) stays at TRUE cost for accounting.

export const CREDIT_USD = 0.01; // $0.01 per credit (customer value)
// Markup on real model cost → gross margin. 2.3× ≈ 57% margin, and still lands at/below
// Higgsfield's effective consumer price (our base cost is lower). Tune this ONE number
// to move all generation pricing at once.
export const MARGIN = 2.3;
export const toCredits = (usd: number) => Math.max(1, Math.round((usd * MARGIN) / CREDIT_USD));
export const MONTHLY_BUDGET_CREDITS = 5000; // internal soft budget cap

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

// Per-image fal price for a picked studio model (the composer/autopilot "choose your
// model" menu). GPT-image is quality-tiered; the rest are flat per image. This is what
// makes the credits CHARGED track the real cost of whichever model actually ran.
export function studioModelUsd(model: string, quality: "standard" | "hd" | "best"): number {
  switch (model) {
    case "gpt-image-2":
    case "gpt-image-1.5":
      return gptImageUsd(quality);
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
    default:
      return gptImageUsd(quality);
  }
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
    // Price by the picked model (gpt-image quality-tiered, others flat per image).
    const per = studioModelUsd(o.model ?? "gpt-image-1.5", o.quality);
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
// Resolution scales video cost (Seedance is billed by pixels × frames; 720p is the
// base rate). Kling ignores resolution → pass 720p (×1). 4K ≈ 5× 720p.
export const VIDEO_RES_MULT: Record<string, number> = { "480p": 0.45, "720p": 1, "1080p": 2.25, "4k": 5 };

// Credits to render one scene: N takes × duration × engine/sec × resolution + a
// keyframe (gpt med). `resolution` defaults to 720p (×1) so existing callers are
// unchanged.
export function sceneCredits(o: { duration: number; takes: number; engine: string; resolution?: string }): number {
  const per = VIDEO_ENGINE_SEC[o.engine] ?? FAL.klingVideoSecAudio;
  const resMult = VIDEO_RES_MULT[(o.resolution ?? "720p").toLowerCase()] ?? 1;
  return toCredits(o.takes * o.duration * per * resMult + FAL.gptImageMedium);
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
  "gpt-image-2": 0.25,
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
  return usd / CREDIT_USD; // TRUE cost (no margin) — internal usage meter only
}

// ---- Plans & packs — single source of truth for billing tiers. ----
// Credits are priced at ≈ $0.01 each; higher tiers bundle more credits per $ (volume
// discount). Generations are charged cost×MARGIN credits, so a plan's real gross margin
// is ~MARGIN at the entry tier and a bit thinner at volume tiers, by design.
export interface Plan {
  id: "free" | "starter" | "pro" | "studio";
  name: string;
  usdPerMonth: number;
  zarPerMonth: number; // what SA customers are charged via Paystack
  creditsPerMonth: number;
  seats: number;
  popular?: boolean;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", usdPerMonth: 0, zarPerMonth: 0, creditsPerMonth: 400, seats: 1, blurb: "Try it — draft models, 720p, watermark." },
  { id: "starter", name: "Starter", usdPerMonth: 19, zarPerMonth: 349, creditsPerMonth: 2000, seats: 1, blurb: "All models, 1080p, no watermark." },
  { id: "pro", name: "Pro", usdPerMonth: 49, zarPerMonth: 899, creditsPerMonth: 6000, seats: 1, popular: true, blurb: "More credits + priority queue." },
  { id: "studio", name: "Studio", usdPerMonth: 149, zarPerMonth: 2699, creditsPerMonth: 20000, seats: 5, blurb: "Team seats, API, fastest queue." },
];

export interface CreditPack {
  id: string;
  usd: number;
  zar: number;
  credits: number;
}
export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_small", usd: 10, zar: 199, credits: 800 },
  { id: "pack_large", usd: 40, zar: 749, credits: 3500 },
];

export const ANNUAL_DISCOUNT = 0.17; // 2 months free on annual billing
export const PACK_EXPIRY_DAYS = 90; // top-up credits expire (breakage improves margin)

// ---- Plan limits — the free tier is capped; ANY paid plan unlocks full quality.
// (Platform owner: set your account's plan to 'studio' so you're not capped.) ----
export interface PlanLimits {
  maxImageQuality: "standard" | "hd" | "best";
  maxVideoResolution: "480p" | "720p" | "1080p" | "4k";
  maxVariations: number;
  watermark: boolean;
}
export function planLimits(plan: string | null | undefined): PlanLimits {
  return plan && plan !== "free"
    ? { maxImageQuality: "best", maxVideoResolution: "4k", maxVariations: 8, watermark: false }
    : { maxImageQuality: "standard", maxVideoResolution: "720p", maxVariations: 2, watermark: true };
}

const Q_ORDER = ["standard", "hd", "best"] as const;
export function clampQuality(
  plan: string | null | undefined,
  q: "standard" | "hd" | "best",
): "standard" | "hd" | "best" {
  const max = planLimits(plan).maxImageQuality;
  return Q_ORDER.indexOf(q) <= Q_ORDER.indexOf(max) ? q : max;
}

const R_ORDER = ["480p", "720p", "1080p", "4k"] as const;
export function clampResolution(plan: string | null | undefined, r: string): string {
  const max = planLimits(plan).maxVideoResolution;
  const ri = R_ORDER.indexOf(r as (typeof R_ORDER)[number]);
  return ri >= 0 && ri <= R_ORDER.indexOf(max) ? r : max;
}
