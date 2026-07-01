// Autopilot runner — on each 60s tick (worker/index.ts) it fires every due rule using
// the SAME directed pipeline as the Create flow, so output is on-brand, not random:
//   swap @handles -> soul names · direct the prompt (mood + subjects) · generate with
//   the reference images + Soul ID sheets (gpt-image-2) · optional AI caption · post.
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { directImage } from "@/lib/ai-ads/image-director";
import { postToSocial } from "@/lib/ayrshare";
import { admin, BUCKET } from "./db";

interface Rule {
  id: string;
  account_id: string;
  prompt: string;
  caption: string;
  platforms: string[];
  interval_hours: number;
  ref_urls: string[] | null;
  soul_ids: string[] | null;
  format: string | null;
  mood: string | null;
  auto_caption: boolean | null;
}

async function autoCaption(brief: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `Write a short, engaging social-media caption (1-2 sentences plus a few relevant hashtags) for a post about: ${brief}. Return ONLY the caption text, no quotes.` }] },
          ],
        }),
      },
    );
    const j = await res.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof t === "string" ? t.trim().slice(0, 600) : "";
  } catch {
    return "";
  }
}

export async function runAutopilotTick(): Promise<void> {
  const { data } = await admin
    .from("autopilot_rules")
    .select("id, account_id, prompt, caption, platforms, interval_hours, ref_urls, soul_ids, format, mood, auto_caption")
    .eq("active", true)
    .lte("next_run_at", new Date().toISOString())
    .limit(10);
  for (const r of (data ?? []) as Rule[]) {
    try {
      await runRule(r);
    } catch (e) {
      console.error(`[autopilot] rule ${r.id}:`, (e as Error)?.message ?? e);
    }
  }
}

async function runRule(r: Rule): Promise<void> {
  // Advance the schedule FIRST so a failure can't hot-loop the rule.
  const nextRun = new Date(Date.now() + Math.max(1, r.interval_hours) * 3_600_000).toISOString();
  await admin
    .from("autopilot_rules")
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun })
    .eq("id", r.id);

  let mediaUrl: string | null = null;
  let status: "posted" | "failed" = "posted";
  let error: string | null = null;
  let ayrshareId: string | undefined;
  let caption = r.caption;
  try {
    // Resolve Soul IDs → reference sheets + a handle→name map + director subjects.
    const refs = [...(r.ref_urls ?? [])];
    const nameByHandle: Record<string, string> = {};
    const subjects: { tag: string; desc: string; kind: string }[] = [];
    if (r.soul_ids?.length) {
      const { data } = await admin
        .from("ad_soul_ids")
        .select("handle, name, kind, storage_path")
        .in("id", r.soul_ids)
        .eq("account_id", r.account_id);
      for (const s of data ?? []) {
        refs.push(admin.storage.from(BUCKET).getPublicUrl(s.storage_path as string).data.publicUrl);
        const handle = String(s.handle ?? "").toLowerCase();
        const name = String(s.name ?? s.handle ?? "");
        if (handle) nameByHandle[handle] = name;
        subjects.push({ tag: name, desc: name, kind: String(s.kind ?? "") });
      }
    }

    // @handle → soul name, then run the same director as Create (mood + subjects).
    const cleanPrompt = r.prompt.replace(/@([a-zA-Z0-9_-]+)/g, (_, h: string) => nameByHandle[h.toLowerCase()] ?? h);
    const format = r.format || "1:1";
    const directed = await directImage({
      prompt: cleanPrompt,
      mood: r.mood || "auto",
      aspect: format,
      subjects: subjects.length ? subjects : undefined,
    });

    const urls = refs.length
      ? await gptImageEdit({ prompt: directed, imageUrls: refs, format, quality: "medium", num: 1, model: "gpt-image-2" })
      : await gptImageGenerate({ prompt: directed, format, quality: "medium", num: 1 });
    if (!urls.length) throw new Error("generation returned no image");

    if (r.auto_caption) caption = (await autoCaption(cleanPrompt)) || r.caption;

    const bytes = new Uint8Array(await (await fetch(urls[0])).arrayBuffer());
    const path = `outputs/${r.account_id}/autopilot/${r.id}/${Date.now()}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    mediaUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const posted = await postToSocial({ post: caption || " ", platforms: r.platforms, mediaUrls: [mediaUrl] });
    ayrshareId = posted.id;
  } catch (e) {
    status = "failed";
    error = String((e as Error)?.message ?? e);
  }

  await admin.from("scheduled_posts").insert({
    account_id: r.account_id,
    caption,
    media_urls: mediaUrl ? [mediaUrl] : [],
    platforms: r.platforms,
    scheduled_at: null,
    status,
    ayrshare_id: ayrshareId ?? null,
    error,
    autopilot_rule_id: r.id,
  });
  console.log(`[autopilot] rule ${r.id} -> ${status}`);
}
