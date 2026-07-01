// Autopilot runner — on each 60s tick (worker/index.ts) it fires every rule whose
// next_run_at has passed: generate a fresh image → post it via Ayrshare → reschedule.
// The @/lib import path works in the worker (tsx), same as run-image/run-soul.
import { gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { postToSocial } from "@/lib/ayrshare";
import { admin, BUCKET } from "./db";

interface Rule {
  id: string;
  account_id: string;
  prompt: string;
  caption: string;
  platforms: string[];
  interval_hours: number;
}

export async function runAutopilotTick(): Promise<void> {
  const { data } = await admin
    .from("autopilot_rules")
    .select("id, account_id, prompt, caption, platforms, interval_hours")
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
  try {
    const urls = await gptImageGenerate({ prompt: r.prompt, format: "1:1", quality: "medium", num: 1 });
    if (!urls.length) throw new Error("generation returned no image");
    const bytes = new Uint8Array(await (await fetch(urls[0])).arrayBuffer());
    const path = `outputs/${r.account_id}/autopilot/${r.id}/${Date.now()}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    mediaUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const posted = await postToSocial({ post: r.caption || " ", platforms: r.platforms, mediaUrls: [mediaUrl] });
    ayrshareId = posted.id;
  } catch (e) {
    status = "failed";
    error = String((e as Error)?.message ?? e);
  }

  await admin.from("scheduled_posts").insert({
    account_id: r.account_id,
    caption: r.caption,
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
