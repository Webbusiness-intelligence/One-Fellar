// Video job runner — ports the synchronous /api/ai-ads/video/create pipeline
// (single-shot + cut-to-cut) into the worker. Reads params from job.brief, runs
// the same lib primitives, attaches ad_assets to the claimed job, returns the
// actual credit cost so the worker can settle.
import { randomUUID } from "node:crypto";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderSceneVideo, seedanceReferenceToVideo, type VideoEngine } from "@/lib/ai-ads/video-models";
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { directCinematic, directCuts, type Subject } from "@/lib/ai-ads/cinematic-director";
import { resolveSkill } from "@/lib/ai-ads/resolve-skill";
import { skillAddendum } from "@/lib/ai-ads/skills";
import { stitchClips } from "@/lib/ai-ads/video-stitch";
import { VIDEO_ENGINE_SEC, FAL, toCredits } from "@/lib/ai-ads/cost";
import { admin, pub, BUCKET, insertAsset, resolveSouls, setProgress, type Job } from "./db";

const ENGINES: VideoEngine[] = ["kling-pro", "kling-turbo", "seedance-pro", "seedance-fast"];
const RESOLUTIONS = ["480p", "720p", "1080p"];

type Brief = {
  prompt?: string;
  engine?: string;
  duration?: number;
  format?: string;
  resolution?: string;
  audio?: boolean;
  count?: number;
  cinematic?: boolean;
  mood?: string;
  cuts?: boolean;
  soulIds?: string[];
  skillId?: string;
  enhancedPrompt?: string; // user-edited director prompt — used verbatim (single shot)
  enhancedKeyframe?: string;
  startImageUrl?: string; // pre-uploaded by the enqueue route
};

export async function runVideoJob(job: Job): Promise<number> {
  const b = (job.brief ?? {}) as Brief;
  const prompt = String(b.prompt ?? "").trim().slice(0, 5000);
  if (!prompt) throw new Error("Describe the video");

  const engine = (ENGINES as string[]).includes(String(b.engine))
    ? (b.engine as VideoEngine)
    : "seedance-fast";
  // kling's prompt field caps at 2500 chars; seedance handles long prompts. Cap what
  // we send (safety net so an over-long director prompt never 422s) and steer the
  // director to stay under the budget so it writes concise-but-complete, not truncated.
  const promptMax = engine.startsWith("kling") ? 2400 : 5000;
  const clampPrompt = (p: string) => (p.length > promptMax ? p.slice(0, promptMax) : p);
  // i2v paths (kling, seedance image-to-video, every cut shot) get NO reference-images
  // array, so @ImageN tags (valid only for seedance reference-to-video) make fal 422.
  // Strip them here; identity for i2v comes from the start/keyframe image, not @tags.
  const clampI2V = (p: string) => clampPrompt(p.replace(/@\s*Image\s*\d+/gi, "the subject"));
  const duration = Math.min(Math.max(Math.round(Number(b.duration) || 5), 3), 15);
  const format = String(b.format || "9:16");
  const resolution = RESOLUTIONS.includes(String(b.resolution)) ? String(b.resolution) : "720p";
  const audio = b.audio !== false;
  const count = Math.min(Math.max(Number(b.count) || 1, 1), 4);
  const cinematic = b.cinematic !== false;
  const mood = String(b.mood ?? "auto").slice(0, 40);
  const cuts = b.cuts === true;
  const soulIds = Array.isArray(b.soulIds) ? b.soulIds.filter((x) => typeof x === "string").slice(0, 4) : [];
  const skill = await resolveSkill(admin, b.skillId, job.account_id);
  const skillText = skill ? skillAddendum(skill) : undefined;

  const adMode =
    mood === "commercial" ||
    mood === "ugc" ||
    /\b(ad|advert|advertis|commercial|promo|product|brand|ugc|unboxing)\b/i.test(prompt)
      ? "ad"
      : "cinematic";

  const { chosen, nameByHandle } = await resolveSouls(job.account_id, soulIds, prompt);
  const soulUrls = chosen.map((c) => c.url);
  const cleanPrompt = prompt.replace(/@([a-zA-Z0-9_-]+)/g, (_, h: string) => nameByHandle[h.toLowerCase()] ?? h);

  const isSeedance = engine.startsWith("seedance");
  const useReference = isSeedance && chosen.length > 0;
  const bitrate = cinematic ? "high" : "standard";
  const minShot = engine === "kling-pro" ? 3 : engine === "kling-turbo" ? 5 : 4;
  const cutsActive = cuts && cinematic && duration >= minShot * 2;

  const subjects: Subject[] | undefined = chosen.length
    ? useReference
      ? chosen.map((c, i) => ({ tag: `@Image${i + 1}`, desc: c.name, kind: c.kind }))
      : chosen.map((c) => ({ tag: c.name, desc: c.name, kind: c.kind }))
    : undefined;

  // @ImageN mapping when cinematic is off (the director emits its own otherwise).
  let referencePrompt = cleanPrompt;
  if (useReference) {
    const tagByHandle: Record<string, string> = {};
    chosen.forEach((c, i) => (tagByHandle[c.handle] = `@Image${i + 1}`));
    referencePrompt = prompt.replace(
      /@([a-zA-Z0-9_-]+)/g,
      (_, h: string) => tagByHandle[h.toLowerCase()] ?? nameByHandle[h.toLowerCase()] ?? h,
    );
  }

  const summary = cleanPrompt.slice(0, 80) || "Video";
  const per = VIDEO_ENGINE_SEC[engine] ?? FAL.klingVideoSecAudio;
  let costUsd = 0; // accumulate actual fal spend

  const saveKeyframe = async (url: string): Promise<string | null> => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const p = `video-src/${job.account_id}/${randomUUID()}.png`;
    const u = await admin.storage.from(BUCKET).upload(p, bytes, { contentType: "image/png", upsert: true });
    return u.error ? null : pub(p);
  };

  const storeVideo = async (vurl: string, variation: number, meta: Record<string, unknown>) => {
    const bytes = new Uint8Array(await (await fetch(vurl)).arrayBuffer());
    const path = `outputs/${job.account_id}/${job.id}/${variation}.mp4`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) return null;
    return insertAsset(job, { type: "video", storagePath: path, variationIndex: variation, metadata: meta });
  };

  // ---- single continuous shot ----
  const makeOne = async (variation: number): Promise<boolean> => {
    const shot = cinematic && !b.enhancedPrompt
      ? await directCinematic({ prompt: cleanPrompt, duration, aspect: format, mode: adMode, mood, subjects, variation, skill: skillText, promptBudget: promptMax })
      : null;
    if (cinematic && !b.enhancedPrompt) costUsd += FAL.geminiText;
    const videoPrompt = b.enhancedPrompt || shot?.videoPrompt || (useReference ? referencePrompt : cleanPrompt);
    const negativePrompt = shot?.negativePrompt;
    const keyframePrompt = b.enhancedPrompt
      ? b.enhancedKeyframe || `${cleanPrompt}. No added text, captions or watermark.`
      : shot?.keyframePrompt ?? `${cleanPrompt}. No added text, captions or watermark.`;

    let startUrl: string | null = b.startImageUrl ?? null;
    if (!useReference && !startUrl) {
      await setProgress(job.id, `take ${variation + 1}: keyframe`);
      const out = soulUrls.length
        ? await gptImageEdit({
            prompt: `${keyframePrompt} CRITICAL: the provided reference image(s) ARE the exact characters — reproduce each one's face, identity, hair, skin tone and wardrobe PRECISELY and recognisably; do NOT invent, replace, merge or generic-ify any person. Feature them all together in the scene.`,
            imageUrls: soulUrls,
            format,
            quality: "medium",
            num: 1,
            model: "gpt-image-2",
          })
        : await gptImageGenerate({ prompt: keyframePrompt, format, quality: "medium", num: 1, model: "gpt-image-1.5" });
      costUsd += FAL.gptImageMedium;
      if (out[0]) startUrl = await saveKeyframe(out[0]);
      if (!startUrl) return false;
    }

    await setProgress(job.id, `take ${variation + 1}: rendering`);
    const run = (a: boolean) =>
      useReference
        ? seedanceReferenceToVideo({ imageUrls: soulUrls, prompt: clampPrompt(videoPrompt), duration, resolution, audio: a, bitrate })
        : renderSceneVideo(engine, {
            startImageUrl: startUrl as string,
            prompt: clampI2V(videoPrompt),
            negativePrompt,
            duration,
            resolution,
            audio: a,
            bitrate,
          });
    let vurl: string | null = null;
    try {
      vurl = await run(audio);
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      if (audio && /content_policy|sensitive|partner_validation/i.test(m)) vurl = await run(false).catch(() => null);
      else throw e;
    }
    if (!vurl) return false;
    costUsd += duration * per;

    const id = await storeVideo(vurl, variation, {
      studio: "video",
      model: engine,
      prompt: videoPrompt,
      summary,
      duration,
      resolution,
      audio,
      cinematic,
      mood,
      ad: adMode === "ad",
    });
    return !!id;
  };

  // ---- cut-to-cut: hero base → reframe per shot → render each → stitch ----
  const makeOneCuts = async (variation: number): Promise<boolean> => {
    await setProgress(job.id, `take ${variation + 1}: directing cuts`);
    const seq = await directCuts({ prompt: cleanPrompt, duration, minShot, aspect: format, mode: adMode, mood, subjects, variation, skill: skillText, promptBudget: promptMax });
    costUsd += FAL.geminiText;
    seq.shots.forEach((s) => (s.transition = "cut")); // hard cuts only (user preference)

    let baseUrl: string | null = b.startImageUrl ?? null;
    if (!baseUrl) {
      await setProgress(job.id, `take ${variation + 1}: hero frame`);
      const out = soulUrls.length
        ? await gptImageEdit({
            prompt: `${seq.baseKeyframePrompt} CRITICAL: the provided reference image(s) ARE the exact characters — reproduce each one's face, identity, hair, skin tone and wardrobe PRECISELY and recognisably; do NOT invent, replace, merge or generic-ify any person. Feature them all together in the scene.`,
            imageUrls: soulUrls,
            format,
            quality: "medium",
            num: 1,
            model: "gpt-image-2",
          })
        : await gptImageGenerate({ prompt: seq.baseKeyframePrompt, format, quality: "medium", num: 1, model: "gpt-image-1.5" });
      costUsd += FAL.gptImageMedium;
      if (out[0]) baseUrl = await saveKeyframe(out[0]);
    }
    if (!baseUrl) return false;
    const base = baseUrl;

    await setProgress(job.id, `take ${variation + 1}: framing ${seq.shots.length} shots`);
    const starts = await Promise.all(
      seq.shots.map(async (shot) => {
        try {
          const out = await gptImageEdit({
            prompt: `${shot.keyframePrompt} CRITICAL: keep the EXACT same person(s) — identical face, identity, hair, skin tone and wardrobe — and the same lighting and colour grade as the reference image; change ONLY the framing, angle and composition. Do NOT alter, replace or generic-ify the subject. No added text.`,
            imageUrls: [base],
            format,
            quality: "medium",
            num: 1,
            model: "gpt-image-2",
          });
          costUsd += FAL.gptImageMedium;
          return (out[0] ? await saveKeyframe(out[0]) : null) ?? base;
        } catch {
          return base;
        }
      }),
    );

    await setProgress(job.id, `take ${variation + 1}: rendering ${seq.shots.length} shots`);
    const shotErrors: string[] = [];
    const renderShot = async (shot: (typeof seq.shots)[number], i: number): Promise<string | null> => {
      const args = {
        startImageUrl: starts[i],
        prompt: clampI2V(`${seq.styleHeader}\n\n${shot.videoPrompt}`),
        negativePrompt: seq.negativePrompt,
        duration: shot.durationSec,
        resolution,
        audio: false,
        bitrate,
      };
      try {
        return await renderSceneVideo(engine, args);
      } catch (e1) {
        console.error(`[worker] cuts shot ${i} attempt 1 failed:`, String((e1 as Error)?.message ?? e1));
        try {
          return await renderSceneVideo(engine, args); // one retry — covers transient fal failures
        } catch (e2) {
          const m = String((e2 as Error)?.message ?? e2);
          console.error(`[worker] cuts shot ${i} attempt 2 failed:`, m);
          shotErrors.push(`shot ${i + 1}: ${m}`);
          return null;
        }
      }
    };
    const rendered = await Promise.all(seq.shots.map((shot, i) => renderShot(shot, i)));
    // Resilient: stitch the shots that rendered (in order); only fail the take if
    // NONE rendered — and then surface the real fal error, not a generic message.
    const survivors = seq.shots
      .map((shot, i) => ({ shot, url: rendered[i] }))
      .filter((x) => x.url) as { shot: (typeof seq.shots)[number]; url: string }[];
    if (!survivors.length) {
      throw new Error(shotErrors.join(" | ") || "all cut shots failed to render");
    }
    if (survivors.length < seq.shots.length) {
      console.warn(
        `[worker] cuts: ${seq.shots.length - survivors.length}/${seq.shots.length} shots failed; stitching ${survivors.length}`,
      );
    }
    const clipUrls = survivors.map((s) => s.url);
    const usedShots = survivors.map((s) => s.shot);
    const totalDur = usedShots.reduce((a, s) => a + s.durationSec, 0);
    costUsd += totalDur * per;

    await setProgress(job.id, `take ${variation + 1}: stitching`);
    const dir = await mkdtemp(join(tmpdir(), "cuts-"));
    try {
      const localPaths = await Promise.all(
        clipUrls.map(async (u, i) => {
          const bytes = new Uint8Array(await (await fetch(u as string)).arrayBuffer());
          const p = join(dir, `s${i}.mp4`);
          await writeFile(p, bytes);
          return p;
        }),
      );
      const stitched = join(dir, "out.mp4");
      await stitchClips(usedShots.map((s, i) => ({ path: localPaths[i], transition: s.transition })), stitched);
      const finalBytes = new Uint8Array(await readFile(stitched));
      const path = `outputs/${job.account_id}/${job.id}/${variation}.mp4`;
      const up = await admin.storage.from(BUCKET).upload(path, finalBytes, { contentType: "video/mp4", upsert: true });
      if (up.error) return false;
      const id = await insertAsset(job, {
        type: "video",
        storagePath: path,
        variationIndex: variation,
        metadata: {
          studio: "video",
          model: engine,
          prompt: `${seq.styleHeader}\n\n${usedShots.map((s, i) => `Shot ${i + 1} (${s.transition}): ${s.videoPrompt}`).join("\n\n")}`,
          summary,
          duration: totalDur,
          resolution,
          audio: false,
          cinematic: true,
          cuts: true,
          shots: usedShots.length,
          ad: adMode === "ad",
        },
      });
      return !!id;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  const runner = cutsActive ? makeOneCuts : makeOne;
  let made = 0;
  let lastErr = "";
  for (let i = 0; i < count; i++) {
    try {
      if (await runner(i)) made++;
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
      console.error(`[worker] video take ${i} failed:`, lastErr);
    }
  }
  console.log(
    `[worker] video ${engine} | ${duration}s | ${resolution} | cuts:${cutsActive} | ${made}/${count} | "${cleanPrompt.slice(0, 50)}"`,
  );
  if (!made) throw new Error(lastErr || "The video didn't render");
  return toCredits(costUsd);
}
