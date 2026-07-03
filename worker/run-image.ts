// Image job runner. Two brief shapes:
//  • SIMPLE (legacy /jobs image): { prompt, quality, format, variations, soulIds, mood, realism }
//    → realism director enriches + souls resolved here.
//  • RESOLVED (from the chat route, which already did planTurn/refs/usedPrompt):
//    { resolvedPrompt, model, quality, num, refUrls, aspect, chatId, assistantMsgId, summary }
//    → just execute gpt-image with the decided prompt/model.
// Either way: upload assets to the claimed job, finalize the chat message, return credits.
import {
  runStudioImage,
  isStudioModel,
  modelSupportsRefs,
  type StudioModelId,
} from "@/lib/ai-ads/chat-models";
import { directImage } from "@/lib/ai-ads/image-director";
import { studioModelUsd, FAL, toCredits } from "@/lib/ai-ads/cost";
import { admin, BUCKET, insertAsset, resolveSouls, setProgress, type Job } from "./db";
import sharp from "sharp";

type Brief = {
  // simple mode
  prompt?: string;
  quality?: "standard" | "hd" | "best";
  format?: string;
  variations?: number;
  soulIds?: string[];
  mood?: string;
  realism?: boolean;
  // resolved mode
  resolvedPrompt?: string;
  model?: string;
  num?: number;
  refUrls?: string[];
  aspect?: string;
  summary?: string;
  // chat linkage
  chatId?: string;
  assistantMsgId?: string;
  watermark?: boolean;
};

// Composite a small "Genalot" wordmark bottom-right — applied to free-tier outputs.
async function addWatermark(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const img = sharp(Buffer.from(bytes));
    const m = await img.metadata();
    const w = m.width ?? 1024;
    const h = m.height ?? 1024;
    const fs = Math.max(16, Math.round(w * 0.032));
    const pad = Math.round(w * 0.022);
    const svg = Buffer.from(
      `<svg width="${w}" height="${h}"><text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="sans-serif" font-weight="700" font-size="${fs}" fill="#ffffff" fill-opacity="0.72" style="paint-order:stroke" stroke="#000000" stroke-opacity="0.28" stroke-width="${Math.max(1, Math.round(fs * 0.06))}">Genalot</text></svg>`,
    );
    return new Uint8Array(await img.composite([{ input: svg }]).png().toBuffer());
  } catch {
    return bytes; // never fail a generation over a watermark
  }
}

export async function runImageJob(job: Job): Promise<number> {
  const b = (job.brief ?? {}) as Brief;
  const quality: "standard" | "hd" | "best" = (["standard", "hd", "best"] as const).includes(
    b.quality as "standard" | "hd" | "best",
  )
    ? (b.quality as "standard" | "hd" | "best")
    : "standard";
  const gptQuality = quality === "standard" ? "low" : quality === "hd" ? "medium" : "high";
  const resolved = typeof b.resolvedPrompt === "string" && b.resolvedPrompt.trim().length > 0;

  let usedPrompt: string;
  let model: StudioModelId;
  let refUrls: string[];
  let num: number;
  let format: string;
  let metaPrompt: string;
  let realismCharged = false;

  if (resolved) {
    usedPrompt = b.resolvedPrompt!; // already includes the ref-role guide from the route
    model = isStudioModel(String(b.model)) ? (b.model as StudioModelId) : "gpt-image-1.5";
    refUrls = Array.isArray(b.refUrls) ? b.refUrls.filter((x) => typeof x === "string") : [];
    num = Math.min(Math.max(Number(b.num) || 1, 1), 8);
    format = String(b.aspect || b.format || "1:1");
    metaPrompt = (b.summary || usedPrompt).slice(0, 200);
  } else {
    const prompt = String(b.prompt ?? "").trim();
    if (!prompt) throw new Error("Type a message");
    format = String(b.format || "1:1");
    num = Math.min(Math.max(Number(b.variations) || 1, 1), 8);
    const realism = b.realism !== false;
    realismCharged = realism;
    const mood = String(b.mood ?? "auto").slice(0, 40);
    const soulIds = Array.isArray(b.soulIds) ? b.soulIds.filter((x) => typeof x === "string").slice(0, 4) : [];
    const { chosen, nameByHandle } = await resolveSouls(job.account_id, soulIds, prompt);
    refUrls = chosen.map((c) => c.url);
    const cleanPrompt = prompt.replace(/@([a-zA-Z0-9_-]+)/g, (_, h: string) => nameByHandle[h.toLowerCase()] ?? h);
    metaPrompt = cleanPrompt;
    await setProgress(job.id, "composing prompt");
    const subjects = chosen.length ? chosen.map((c) => ({ tag: c.name, desc: c.name, kind: c.kind })) : undefined;
    const concept = realism ? await directImage({ prompt: cleanPrompt, mood, aspect: format, subjects }) : cleanPrompt;
    usedPrompt = `${concept} No added text, captions, watermark or logo.`;
    model = isStudioModel(String(b.model))
      ? (b.model as StudioModelId)
      : chosen.length || quality === "best"
        ? "gpt-image-2"
        : "gpt-image-1.5";
  }

  // References only work on ref-capable models — bump a prompt-only pick to GPT Image 2.
  if (refUrls.length && !modelSupportsRefs(model)) model = "gpt-image-2";

  await setProgress(job.id, "rendering");
  const urls = await runStudioImage({
    model,
    prompt:
      refUrls.length && !resolved
        ? `${usedPrompt} Feature the provided reference subject(s) together, keeping each accurate and recognisable.`
        : usedPrompt,
    format,
    imageUrls: refUrls,
    quality: gptQuality,
    num,
  });

  const assetIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    let bytes = new Uint8Array(await (await fetch(urls[i])).arrayBuffer());
    if (b.watermark) bytes = await addWatermark(bytes); // free-tier outputs carry the wordmark
    const path = `outputs/${job.account_id}/${job.id}/${i}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) continue;
    const id = await insertAsset(job, {
      type: "image",
      storagePath: path,
      variationIndex: i,
      metadata: { studio: "create", model, prompt: metaPrompt, genPrompt: usedPrompt, aspect: format, quality },
    });
    if (id) assetIds.push(id);
  }
  const made = assetIds.length;
  console.log(`[worker] image ${model} | ${gptQuality} | ${made}/${num} | "${metaPrompt.slice(0, 50)}"`);
  if (!made) throw new Error("Image generation failed");

  // Finalize the chat thread: update the route's pending assistant message, or insert
  // one (the simple /jobs path doesn't pre-create one).
  const caption = made > 1 ? `Here are ${made} variations.` : "Here you go.";
  const meta = { model, aspect: format, quality, pending: false };
  if (b.assistantMsgId) {
    await admin
      .from("ad_chat_messages")
      .update({ text: caption, asset_ids: assetIds, metadata: meta })
      .eq("id", b.assistantMsgId);
  } else if (b.chatId) {
    await admin.from("ad_chat_messages").insert({
      account_id: job.account_id,
      chat_id: b.chatId,
      role: "assistant",
      text: caption,
      asset_ids: assetIds,
      metadata: meta,
    });
  }
  return toCredits(num * studioModelUsd(model, quality) + (realismCharged ? FAL.geminiText : 0));
}
