// /api/ai-ads/video/create  (POST, multipart)
// Soul-ID-style standalone video creator. Resolves a start frame (uploaded image
// > @-referenced Soul ID > a keyframe generated from the prompt), has a vision
// "director" write the cinematic motion prompt, then renders with the chosen
// engine (Kling / Seedance). Persists a video asset and returns it.
// Fields: prompt, engine, duration, format?, soulIds?(JSON), file?(start image)

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { renderSceneVideo, seedanceReferenceToVideo, type VideoEngine } from "@/lib/ai-ads/video-models";
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { directCinematic, type Subject } from "@/lib/ai-ads/cinematic-director";

const BUCKET = "ad-studio";
const ENGINES: VideoEngine[] = ["kling-pro", "kling-turbo", "seedance-pro", "seedance-fast"];

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const form = await req.formData();
    const prompt = String(form.get("prompt") ?? "").trim().slice(0, 600);
    const engine = (ENGINES as string[]).includes(String(form.get("engine")))
      ? (String(form.get("engine")) as VideoEngine)
      : "kling-pro";
    // 3–15s overall; each engine clamps to its own range in video-models.
    const duration = Math.min(Math.max(Math.round(Number(form.get("duration")) || 5), 3), 15);
    const format = String(form.get("format") || "9:16");
    let soulIds: string[] = [];
    try {
      const r = JSON.parse(String(form.get("soulIds") ?? "[]"));
      if (Array.isArray(r)) soulIds = r.filter((x) => typeof x === "string").slice(0, 4);
    } catch {
      /* ignore */
    }
    // Quality (Seedance only — Kling renders native), audio, and how many to make.
    const RESOLUTIONS = ["480p", "720p", "1080p", "4k"];
    const resolution = RESOLUTIONS.includes(String(form.get("resolution")))
      ? String(form.get("resolution"))
      : "1080p";
    const audio = String(form.get("audio") ?? "true") !== "false";
    const count = Math.min(Math.max(Number(form.get("count")) || 1, 1), 4);
    // Cinematic director (default on) — applies the realism playbook + adapts per mood;
    // off = the user's raw prompt straight to the model.
    const cinematic = String(form.get("cinematic") ?? "true") !== "false";
    const mood = String(form.get("mood") ?? "auto").slice(0, 40);
    const adMode =
      mood === "commercial" ||
      mood === "ugc" ||
      /\b(ad|advert|advertis|commercial|promo|product|brand|ugc|unboxing)\b/i.test(prompt)
        ? "ad"
        : "cinematic";
    if (!prompt) return NextResponse.json({ error: "Describe the video" }, { status: 400 });

    // Resolve @-referenced Soul IDs — explicit picks (soulIds) AND any @handle typed
    // in the prompt. Keep the chosen souls ordered so Seedance can bind each to an
    // @ImageN tag natively.
    const handleMatches = [...prompt.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase());
    let chosen: Array<{ handle: string; name: string; kind: string; url: string }> = [];
    const nameByHandle: Record<string, string> = {};
    if (soulIds.length || handleMatches.length) {
      const { data: ss } = await admin
        .from("ad_soul_ids")
        .select("id, handle, name, kind, storage_path")
        .eq("account_id", ctx.accountId);
      for (const s of ss ?? []) nameByHandle[String(s.handle).toLowerCase()] = String(s.name);
      chosen = (ss ?? [])
        .filter(
          (s) =>
            soulIds.includes(s.id as string) ||
            handleMatches.includes(String(s.handle).toLowerCase()),
        )
        .slice(0, 9)
        .map((s) => ({
          handle: String(s.handle).toLowerCase(),
          name: String(s.name),
          kind: String(s.kind),
          url: pub(s.storage_path as string),
        }));
    }
    const soulUrls = chosen.map((c) => c.url);
    // Prompt with @handles → the asset's real name (used by the non-reference paths).
    const cleanPrompt = prompt.replace(
      /@([a-zA-Z0-9_-]+)/g,
      (_, h: string) => nameByHandle[h.toLowerCase()] ?? h,
    );

    const isSeedance = engine.startsWith("seedance");
    // Seedance natively seeds MANY references (reference-to-video, @ImageN tags); Kling
    // takes one start frame, so there we compose the subjects into a keyframe.
    const useReference = isSeedance && chosen.length > 0;
    const bitrate = cinematic ? "high" : "standard";

    // @ImageN mapping used when cinematic is OFF (the director emits @ImageN itself via
    // `subjects` when ON).
    let referencePrompt = cleanPrompt;
    if (useReference) {
      const tagByHandle: Record<string, string> = {};
      chosen.forEach((c, i) => {
        tagByHandle[c.handle] = `@Image${i + 1}`;
      });
      referencePrompt = prompt.replace(
        /@([a-zA-Z0-9_-]+)/g,
        (_, h: string) => tagByHandle[h.toLowerCase()] ?? nameByHandle[h.toLowerCase()] ?? h,
      );
    }

    // Subjects for the director: @ImageN tags in Seedance reference mode; by-name when
    // composited into a keyframe.
    const subjects: Subject[] | undefined = chosen.length
      ? useReference
        ? chosen.map((c, i) => ({ tag: `@Image${i + 1}`, desc: c.name, kind: c.kind }))
        : chosen.map((c) => ({ tag: c.name, desc: c.name, kind: c.kind }))
      : undefined;

    // A user-uploaded start frame is shared across all variations.
    let uploadedStart: string | null = null;
    const file = form.get("file");
    if (!useReference && file instanceof File && file.size) {
      const png = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const p = `video-src/${ctx.accountId}/${randomUUID()}.png`;
      const u = await admin.storage.from(BUCKET).upload(p, png, { contentType: "image/png", upsert: true });
      if (!u.error) uploadedStart = pub(p);
    }

    const saveKeyframe = async (url: string) => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const p = `video-src/${ctx.accountId}/${randomUUID()}.png`;
      const u = await admin.storage.from(BUCKET).upload(p, bytes, { contentType: "image/png", upsert: true });
      return u.error ? null : pub(p);
    };

    const summary = cleanPrompt.slice(0, 80) || "Video";

    // One full take: direct (apply the realism playbook, adapt to mood, vary per take)
    // → build a start frame for image-to-video → render → store.
    const makeOne = async (
      variation: number,
    ): Promise<{ id: string; url: string; label: string; duration: number } | null> => {
      const shot = cinematic
        ? await directCinematic({
            prompt: cleanPrompt,
            duration,
            aspect: format,
            mode: adMode,
            mood,
            subjects,
            variation,
          })
        : null;
      const videoPrompt = shot?.videoPrompt ?? (useReference ? referencePrompt : cleanPrompt);
      const negativePrompt = shot?.negativePrompt;
      const keyframePrompt =
        shot?.keyframePrompt ?? `${cleanPrompt}. No added text, captions or watermark.`;

      // Start frame for image-to-video (reference mode needs none).
      let startUrl: string | null = uploadedStart;
      if (!useReference && !startUrl) {
        try {
          const out = soulUrls.length
            ? await gptImageEdit({
                prompt: `${keyframePrompt} Feature the provided reference subject(s) together, keeping each accurate and recognisable.`,
                imageUrls: soulUrls,
                format,
                quality: "high",
                num: 1,
                model: "gpt-image-2",
              })
            : await gptImageGenerate({
                prompt: keyframePrompt,
                format,
                quality: "high",
                num: 1,
                model: "gpt-image-2",
              });
          if (out[0]) startUrl = await saveKeyframe(out[0]);
        } catch (e) {
          console.error("[ai-ads/video/create] keyframe failed:", e);
        }
        if (!startUrl) return null;
      }

      // Render (with the audio content-policy silent-retry).
      const run = (a: boolean) =>
        useReference
          ? seedanceReferenceToVideo({
              imageUrls: soulUrls,
              prompt: videoPrompt,
              duration,
              resolution,
              audio: a,
              bitrate,
            })
          : renderSceneVideo(engine, {
              startImageUrl: startUrl as string,
              prompt: videoPrompt,
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
        if (audio && /content_policy|sensitive|partner_validation/i.test(m)) {
          console.warn("[ai-ads/video/create] audio flagged — retrying silent");
          try {
            vurl = await run(false);
          } catch (e2) {
            console.error("[ai-ads/video/create] silent retry failed:", e2);
          }
        } else {
          console.error("[ai-ads/video/create] render failed:", e);
        }
      }
      if (!vurl) return null;

      // Store.
      const { data: job } = await admin
        .from("ad_jobs")
        .insert({
          account_id: ctx.accountId,
          created_by: ctx.userId,
          type: "video",
          prompt: summary,
          status: "completed",
          model: engine,
        })
        .select("id")
        .single();
      const jobId = job!.id as string;
      const bytes = new Uint8Array(await (await fetch(vurl)).arrayBuffer());
      const path = `outputs/${ctx.accountId}/${jobId}/0.mp4`;
      const up = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (up.error) return null;
      const { data: asset } = await admin
        .from("ad_assets")
        .insert({
          account_id: ctx.accountId,
          job_id: jobId,
          type: "video",
          storage_path: path,
          variation_index: variation,
          metadata: {
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
          },
        })
        .select("id")
        .single();
      return asset ? { id: asset.id as string, url: pub(path), label: summary, duration } : null;
    };

    const results = await Promise.all(Array.from({ length: count }).map((_, i) => makeOne(i)));
    const videos = results.filter((v): v is NonNullable<typeof v> => !!v);
    console.log(
      `[ai-ads/video/create] ${engine} | ${duration}s | ${resolution} | audio:${audio} | cinematic:${cinematic} | ${videos.length}/${count} | "${cleanPrompt.slice(0, 60)}"`,
    );
    if (!videos.length)
      return NextResponse.json({ error: "The video didn't render — please try again." }, { status: 502 });
    return NextResponse.json({ videos });
  } catch (err) {
    return toErrorResponse(err);
  }
}
