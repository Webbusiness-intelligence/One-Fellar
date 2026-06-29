// /api/ai-ads/commercial/[id]/asset  (POST, multipart)
// Fields: role, tag, instruction, sourceAssetId?   Files: source? (upload)
// Asset Studio: generates a reusable @tag REFERENCE SHEET (product multi-view,
// character full-body+face, location plate, prop) — from the product, an uploaded
// image, or an existing asset. Registers it in bible.assets, then RE-SCRIPTS the
// storyboard so the new asset (character/location/etc.) is woven through the scenes
// (skipped if any scene is already locked, to protect rendered work).

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";
import { buildCommercial } from "@/lib/ai-ads/commercial-director";

const BUCKET = "ad-studio";
const ROLES = ["product", "character", "location", "prop"];

function sheetPrompt(role: string, instruction: string, hasRef: boolean): { prompt: string; format: string } {
  const ref = hasRef
    ? " Reproduce the subject in the reference image EXACTLY (same identity, form, colours, label, proportions); do not restyle or replace it."
    : "";
  switch (role) {
    case "product":
      return {
        format: "1:1",
        prompt: `Technical PRODUCT reference sheet of ${instruction}, shown in four views in a clean 2x2 grid — front, back, top-down, and 3/4 angle — isolated on a neutral light-grey background, sharp even studio lighting, photorealistic materials and textures, ultra high resolution. Thin grey dividers between views only. NO text, NO labels, NO callouts.${ref}`,
      };
    case "character":
      return {
        format: "16:9",
        prompt: `CHARACTER reference sheet: two panels side by side on a neutral grey studio background — LEFT a full-body standing view, RIGHT a head-and-shoulders close-up — of ${instruction}. Identical identity, face, hair and wardrobe across both panels, photorealistic, soft even studio light, 35mm film look. NO text, NO labels.${ref}`,
      };
    case "location":
      return {
        format: "16:9",
        prompt: `Cinematic LOCATION plate: an empty establishing wide shot of ${instruction}. Anamorphic lens look, fine film grain, premium colour grade, deep focus, generous negative space. NO people, NO product, NO text — just the environment, ready to place subjects into.`,
      };
    default:
      return {
        format: "1:1",
        prompt: `PROP reference of ${instruction}, shown from a few clean angles, isolated on a neutral grey background, photorealistic, sharp studio lighting, high detail. NO text, NO labels.${ref}`,
      };
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const form = await req.formData();
    const role = ROLES.includes(String(form.get("role"))) ? String(form.get("role")) : "product";
    const instruction = String(form.get("instruction") ?? "").trim().slice(0, 400);
    let tag = String(form.get("tag") ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    if (!tag) tag = role;
    if (!instruction) return NextResponse.json({ error: "Describe the asset" }, { status: 400 });

    const { data: project } = await admin
      .from("ad_commercials")
      .select("brief, preset, format, duration_target, bible")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const bible = (project.bible as Record<string, unknown>) ?? {};

    // Resolve a reference image: uploaded file wins, then a chosen asset, then the product.
    let refUrl: string | null = null;
    const srcFile = form.get("source");
    if (srcFile instanceof File && srcFile.size) {
      const png = await sharp(Buffer.from(await srcFile.arrayBuffer()))
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      const p = `commercial-src/${ctx.accountId}/${randomUUID()}.png`;
      const up = await admin.storage.from(BUCKET).upload(p, png, { contentType: "image/png", upsert: true });
      if (!up.error) refUrl = pub(p);
    } else if (form.get("sourceAssetId")) {
      const { data: a } = await admin
        .from("ad_assets")
        .select("storage_path")
        .eq("id", String(form.get("sourceAssetId")))
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (a) refUrl = pub(a.storage_path as string);
    }
    if (!refUrl && (role === "product" || role === "character" || role === "prop")) {
      refUrl = (bible.productUrl as string) ?? null;
    }

    const { prompt, format } = sheetPrompt(role, instruction, !!refUrl);
    let url: string | null = null;
    try {
      const out = refUrl
        ? await gptImageEdit({ prompt, imageUrls: [refUrl], format, quality: "high", num: 1 })
        : await gptImageGenerate({ prompt, format, quality: "high", num: 1 });
      url = out[0] ?? null;
    } catch (e) {
      console.error("[ai-ads/commercial] asset gen failed:", e);
    }
    if (!url) return NextResponse.json({ error: "Couldn't generate that sheet — try again" }, { status: 502 });

    // Persist as an image asset.
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "image",
        prompt: `@${tag} (${role})`,
        status: "completed",
        model: "asset-sheet",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const path = `outputs/${ctx.accountId}/${jobId}/0.png`;
    const upA = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upA.error) throw upA.error;
    const { data: asset } = await admin
      .from("ad_assets")
      .insert({
        account_id: ctx.accountId,
        job_id: jobId,
        type: "image",
        storage_path: path,
        variation_index: 0,
        metadata: { model: "asset-sheet", commercial: id, tag, role, prompt },
      })
      .select("id")
      .single();
    const assetId = asset!.id as string;

    // Register in the @tag registry.
    const registry = (Array.isArray(bible.assets) ? bible.assets : []) as Array<{
      tag: string;
      role: string;
      label: string;
      id: string;
    }>;
    const entry = { id: assetId, tag, role, label: instruction.slice(0, 60) };
    const nextRegistry = [...registry.filter((r) => !(r.tag === tag && r.role === role)), entry];

    // Re-script the storyboard to weave in all current assets — unless a scene is
    // already locked (protect rendered work).
    let newScenes: Array<Record<string, unknown>> | null = null;
    const { data: existing } = await admin
      .from("ad_commercial_scenes")
      .select("id, locked")
      .eq("commercial_id", id);
    const anyLocked = (existing ?? []).some((s) => s.locked);
    const updatedBible: Record<string, unknown> = { ...bible, assets: nextRegistry };

    if (!anyLocked && bible.productUrl) {
      try {
        const plan = await buildCommercial({
          imageUrl: bible.productUrl as string,
          brief: (project.brief as string) ?? "",
          durationTarget: (project.duration_target as number) ?? 30,
          preset: (project.preset as string) ?? "tv_spot",
          format: (project.format as string) ?? "9:16",
          assets: nextRegistry.map((r) => ({ tag: r.tag, role: r.role, label: r.label })),
        });
        updatedBible.text = plan.bible;
        updatedBible.storyline = plan.storyline;
        updatedBible.negativePrompt = plan.negativePrompt;
        await admin.from("ad_commercial_scenes").delete().eq("commercial_id", id);
        const rows = plan.scenes.map((s, i) => ({
          account_id: ctx.accountId,
          commercial_id: id,
          idx: i,
          summary: s.summary,
          keyframe_prompt: s.keyframePrompt,
          prompt: s.prompt,
          duration: s.duration,
          status: "pending",
        }));
        const { data: inserted } = await admin
          .from("ad_commercial_scenes")
          .insert(rows)
          .select("id, idx, summary, keyframe_prompt, prompt, duration, status, locked");
        newScenes = (inserted ?? []).sort(
          (a, b) => (a.idx as number) - (b.idx as number),
        ) as Array<Record<string, unknown>>;
      } catch (e) {
        console.error("[ai-ads/commercial] rescript failed:", e);
      }
    }

    await admin
      .from("ad_commercials")
      .update({ bible: updatedBible, updated_at: new Date().toISOString() })
      .eq("id", id);

    console.log(
      `[ai-ads/commercial] asset @${tag} (${role}) for ${id}${newScenes ? ` + rescripted ${newScenes.length} scenes` : anyLocked ? " (locked, no rescript)" : ""}`,
    );
    return NextResponse.json({
      asset: { id: assetId, url: pub(path), tag, role, label: entry.label },
      scenes: newScenes,
      bibleText: (updatedBible.text as string) ?? undefined,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
