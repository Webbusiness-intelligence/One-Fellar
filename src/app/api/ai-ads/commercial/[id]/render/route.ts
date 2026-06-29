// /api/ai-ads/commercial/[id]/render  (POST, JSON)
// Body: { sceneId, variations? }
// Renders ONE scene: generate its keyframe (gpt-image, product-consistent) if not
// already made, then render N Kling video variations of the scene's motion prompt.
// Stores keyframe (image) + variations (video) as ad_assets and updates the scene.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gptImageEdit } from "@/lib/ai-ads/chat-models";
import { renderSceneVideo, type VideoEngine } from "@/lib/ai-ads/video-models";
import { mapLimit } from "@/lib/ai-ads/batch";

const ENGINES: VideoEngine[] = ["kling-pro", "kling-turbo", "seedance-pro", "seedance-fast"];

const BUCKET = "ad-studio";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const body = (await req.json()) as { sceneId?: string; variations?: number; engine?: string };
    const sceneId = String(body.sceneId ?? "");
    const variations = Math.min(Math.max(Number(body.variations) || 2, 1), 4);
    if (!sceneId) return NextResponse.json({ error: "No scene" }, { status: 400 });

    const { data: project } = await admin
      .from("ad_commercials")
      .select("format, bible")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const bible = (project.bible as {
      productUrl?: string;
      negativePrompt?: string;
      model?: string;
      assets?: Array<{ id: string; role: string }>;
    }) ?? {};
    const productUrl = bible.productUrl ?? "";
    const negativePrompt = bible.negativePrompt;
    const format = (project.format as string) ?? "9:16";
    // Per-scene engine (from the request) overrides the project default.
    const engine: VideoEngine = ENGINES.includes(body.engine as VideoEngine)
      ? (body.engine as VideoEngine)
      : ENGINES.includes(bible.model as VideoEngine)
        ? (bible.model as VideoEngine)
        : "kling-pro";

    // Reference sheets (@tag product + character assets) anchor consistency.
    const refIds = (bible.assets ?? [])
      .filter((a) => a.role === "product" || a.role === "character")
      .map((a) => a.id);
    let sheetUrls: string[] = [];
    if (refIds.length) {
      const { data: refAssets } = await admin
        .from("ad_assets")
        .select("storage_path")
        .in("id", refIds);
      sheetUrls = (refAssets ?? []).map((a) => pub(a.storage_path as string));
    }
    const keyframeRefs = (sheetUrls.length ? sheetUrls : productUrl ? [productUrl] : []).slice(0, 3);

    const { data: scene } = await admin
      .from("ad_commercial_scenes")
      .select("id, keyframe_prompt, prompt, duration, keyframe_asset_id, variation_asset_ids")
      .eq("id", sceneId)
      .eq("commercial_id", id)
      .maybeSingle();
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    // One job to hang this render's assets on.
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "video",
        prompt: (scene.prompt as string) ?? "Scene",
        status: "completed",
        model: "commercial-scene",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const storeAsset = async (url: string, kind: "image" | "video", i: number) => {
      const ext = kind === "video" ? "mp4" : "png";
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const path = `outputs/${ctx.accountId}/${jobId}/${kind}-${i}.${ext}`;
      const up = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: kind === "video" ? "video/mp4" : "image/png", upsert: true });
      if (up.error) return null;
      const { data: asset } = await admin
        .from("ad_assets")
        .insert({
          account_id: ctx.accountId,
          job_id: jobId,
          type: kind,
          storage_path: path,
          variation_index: i,
          metadata: { model: "commercial-scene", commercial: id, scene: sceneId },
        })
        .select("id")
        .single();
      return asset ? { id: asset.id as string, url: pub(path) } : null;
    };

    // 1) Keyframe (reuse if already made).
    let keyframe: { id: string; url: string } | null = null;
    if (scene.keyframe_asset_id) {
      const { data: a } = await admin
        .from("ad_assets")
        .select("id, storage_path")
        .eq("id", scene.keyframe_asset_id as string)
        .maybeSingle();
      if (a) keyframe = { id: a.id as string, url: pub(a.storage_path as string) };
    }
    if (!keyframe && keyframeRefs.length) {
      const kfPrompt =
        `${scene.keyframe_prompt}. The product/character in the reference image(s) are the HERO — reproduce them EXACTLY (same form, identity, label and branding); never alter or replace them. Cinematic premium commercial photography. Keep the whole composition inside the frame.`;
      try {
        const out = await gptImageEdit({
          prompt: kfPrompt,
          imageUrls: keyframeRefs,
          format,
          quality: "medium",
          num: 1,
        });
        if (out[0]) keyframe = await storeAsset(out[0], "image", 0);
      } catch (e) {
        console.error("[ai-ads/commercial] keyframe failed:", e);
      }
    }
    const base = keyframe?.url ?? productUrl;
    if (!base) return NextResponse.json({ error: "No image to animate" }, { status: 400 });

    // 2) Render N variations.
    const duration = [3, 5, 10].includes(Number(scene.duration)) ? Number(scene.duration) : 5;
    const rendered = await mapLimit(Array.from({ length: variations }), 2, async (_v, i) => {
      for (let a = 0; a < 2; a++) {
        try {
          const u = await renderSceneVideo(engine, {
            startImageUrl: base,
            prompt: scene.prompt as string,
            negativePrompt,
            duration,
          });
          if (u) return await storeAsset(u, "video", i + 1);
        } catch (e) {
          console.error("[ai-ads/commercial] variation failed:", e);
        }
      }
      return null;
    });
    const variationsOut = rendered.filter((v): v is { id: string; url: string } => !!v);
    console.log(
      `[ai-ads/commercial] render scene ${sceneId} | keyframe:${keyframe ? "y" : "n"} | ${variationsOut.length}/${variations} clips`,
    );

    // 3) Update scene.
    const prevVars = ((scene.variation_asset_ids as string[]) ?? []).filter(Boolean);
    await admin
      .from("ad_commercial_scenes")
      .update({
        keyframe_asset_id: keyframe?.id ?? scene.keyframe_asset_id ?? null,
        variation_asset_ids: [...prevVars, ...variationsOut.map((v) => v.id)],
        status: variationsOut.length ? "rendered" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sceneId);

    return NextResponse.json({ keyframe, variations: variationsOut });
  } catch (err) {
    return toErrorResponse(err);
  }
}
