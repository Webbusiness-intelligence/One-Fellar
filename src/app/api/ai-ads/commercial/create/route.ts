// /api/ai-ads/commercial/create  (POST, multipart)
// Fields: brief?, duration?, preset?, format?, assetId? (existing gallery asset)
// Files:  product? (upload)
// Creates a Commercial project: resolves the hero product → runs the director
// (production bible + timed scene list) → persists ad_commercials + scenes.
// Returns the project id + scenes for the storyboard view. (No rendering yet.)

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildCommercial } from "@/lib/ai-ads/commercial-director";
import { FORMAT_IDS } from "@/lib/ai-ads/generate-image";

const BUCKET = "ad-studio";
const PRESETS = ["tv_spot", "hyper_motion", "ugc", "unboxing", "product_review", "wild_card"];
const ENGINES = ["kling-pro", "kling-turbo", "seedance-pro", "seedance-fast"];

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const form = await req.formData();
    const brief = String(form.get("brief") ?? "").trim().slice(0, 500);
    const duration = Math.min(Math.max(Number(form.get("duration")) || 30, 15), 60);
    const preset = PRESETS.includes(String(form.get("preset"))) ? String(form.get("preset")) : "tv_spot";
    const format = FORMAT_IDS.includes(String(form.get("format"))) ? String(form.get("format")) : "9:16";
    const model = ENGINES.includes(String(form.get("model"))) ? String(form.get("model")) : "kling-pro";
    const music = String(form.get("music")) === "1";
    const voiceover = String(form.get("voiceover")) === "1";
    const musicVibe = String(form.get("musicVibe") ?? "").trim().slice(0, 80);
    const voVoice = String(form.get("voVoice") ?? "").trim().slice(0, 40);
    const assetId = String(form.get("assetId") ?? "");

    // Resolve the hero product image: an uploaded file, or an existing asset.
    let productUrl: string | null = null;
    const assetIds: string[] = [];
    const productFile = form.get("product");
    if (productFile instanceof File && productFile.size) {
      const png = await sharp(Buffer.from(await productFile.arrayBuffer()))
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const path = `commercial-src/${ctx.accountId}/${randomUUID()}.png`;
      const up = await admin.storage
        .from(BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (!up.error) productUrl = pub(path);
    } else if (assetId) {
      const { data: a } = await admin
        .from("ad_assets")
        .select("storage_path")
        .eq("id", assetId)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (a) {
        productUrl = pub(a.storage_path as string);
        assetIds.push(assetId);
      }
    }
    if (!productUrl) {
      return NextResponse.json({ error: "Add a product image to start" }, { status: 400 });
    }

    // Director → production bible + timed scene list.
    const plan = await buildCommercial({
      imageUrl: productUrl,
      brief,
      durationTarget: duration,
      preset,
      format,
    });

    const { data: project, error } = await admin
      .from("ad_commercials")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        title: brief.slice(0, 60) || "Untitled commercial",
        brief,
        preset,
        format,
        duration_target: duration,
        asset_ids: assetIds,
        bible: {
          text: plan.bible,
          storyline: plan.storyline,
          productUrl,
          negativePrompt: plan.negativePrompt,
          model,
          music,
          voiceover,
          ...(musicVibe ? { musicVibe } : {}),
          ...(voVoice ? { voVoice } : {}),
        },
        status: "scripted",
      })
      .select("id")
      .single();
    if (error) throw error;
    const commercialId = project!.id as string;

    const rows = plan.scenes.map((s, i) => ({
      account_id: ctx.accountId,
      commercial_id: commercialId,
      idx: i,
      summary: s.summary,
      keyframe_prompt: s.keyframePrompt,
      prompt: s.prompt,
      duration: s.duration,
      status: "pending",
    }));
    const { data: scenes } = await admin
      .from("ad_commercial_scenes")
      .insert(rows)
      .select("id, idx, summary, keyframe_prompt, prompt, duration, status, locked");

    console.log(
      `[ai-ads/commercial] created ${commercialId} | ${preset} | ${duration}s | ${plan.scenes.length} scenes`,
    );

    return NextResponse.json({
      id: commercialId,
      preset,
      format,
      duration,
      model,
      bible: plan.bible,
      storyline: plan.storyline,
      scenes: (scenes ?? []).sort((a, b) => a.idx - b.idx),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
