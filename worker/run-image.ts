// Image job runner — the core Create generation: realism director enriches the
// prompt, gpt-image renders N variations (gpt-image-2 when souls are referenced
// or quality=Best, else gpt-image-1.5), composing any @-referenced Soul IDs.
// Attaches ad_assets to the claimed job; returns actual credit cost.
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { directImage } from "@/lib/ai-ads/image-director";
import { gptImageUsd, FAL, toCredits } from "@/lib/ai-ads/cost";
import { admin, BUCKET, insertAsset, resolveSouls, setProgress, type Job } from "./db";

type Brief = {
  prompt?: string;
  quality?: "standard" | "hd" | "best";
  format?: string;
  variations?: number;
  soulIds?: string[];
  mood?: string;
  realism?: boolean;
  chatId?: string;
};

export async function runImageJob(job: Job): Promise<number> {
  const b = (job.brief ?? {}) as Brief;
  const prompt = String(b.prompt ?? "").trim();
  if (!prompt) throw new Error("Type a message");

  const quality: "standard" | "hd" | "best" = (["standard", "hd", "best"] as const).includes(
    b.quality as "standard" | "hd" | "best",
  )
    ? (b.quality as "standard" | "hd" | "best")
    : "standard";
  const format = String(b.format || "1:1");
  const variations = Math.min(Math.max(Number(b.variations) || 1, 1), 8);
  const realism = b.realism !== false;
  const mood = String(b.mood ?? "auto").slice(0, 40);
  const soulIds = Array.isArray(b.soulIds) ? b.soulIds.filter((x) => typeof x === "string").slice(0, 4) : [];

  const { chosen, nameByHandle } = await resolveSouls(job.account_id, soulIds, prompt);
  const soulUrls = chosen.map((c) => c.url);
  const cleanPrompt = prompt.replace(/@([a-zA-Z0-9_-]+)/g, (_, h: string) => nameByHandle[h.toLowerCase()] ?? h);

  await setProgress(job.id, "composing prompt");
  const subjects = chosen.length ? chosen.map((c) => ({ tag: c.name, desc: c.name, kind: c.kind })) : undefined;
  const concept = realism
    ? await directImage({ prompt: cleanPrompt, mood, aspect: format, subjects })
    : cleanPrompt;
  const usedPrompt = `${concept} No added text, captions, watermark or logo.`;

  const gptModel = chosen.length || quality === "best" ? "gpt-image-2" : "gpt-image-1.5";
  const gptQuality = quality === "standard" ? "low" : quality === "hd" ? "medium" : "high";

  await setProgress(job.id, "rendering");
  const urls = soulUrls.length
    ? await gptImageEdit({
        prompt: `${usedPrompt} Feature the provided reference subject(s) together, keeping each accurate and recognisable.`,
        imageUrls: soulUrls,
        format,
        quality: gptQuality,
        num: variations,
        model: gptModel,
      })
    : await gptImageGenerate({ prompt: usedPrompt, format, quality: gptQuality, num: variations, model: gptModel });

  const assetIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const bytes = new Uint8Array(await (await fetch(urls[i])).arrayBuffer());
    const path = `outputs/${job.account_id}/${job.id}/${i}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) continue;
    const id = await insertAsset(job, {
      type: "image",
      storagePath: path,
      variationIndex: i,
      metadata: { studio: "create", model: gptModel, prompt: cleanPrompt, genPrompt: usedPrompt, aspect: format, quality },
    });
    if (id) assetIds.push(id);
  }
  const made = assetIds.length;
  console.log(`[worker] image ${gptModel} | ${gptQuality} | ${made}/${variations} | "${cleanPrompt.slice(0, 50)}"`);
  if (!made) throw new Error("Image generation failed");

  // Append the assistant message so the Create thread reads as a conversation
  // (the GET /chat/:id route resolves asset_ids → asset URLs).
  if (b.chatId) {
    const caption = made > 1 ? `Here are ${made} variations.` : "Here you go.";
    await admin.from("ad_chat_messages").insert({
      account_id: job.account_id,
      chat_id: b.chatId,
      role: "assistant",
      text: caption,
      asset_ids: assetIds,
      metadata: { model: gptModel, aspect: format, quality },
    });
  }
  return toCredits(variations * gptImageUsd(quality) + (realism ? FAL.geminiText : 0));
}
