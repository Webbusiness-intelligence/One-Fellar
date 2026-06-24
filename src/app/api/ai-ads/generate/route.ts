// /api/ai-ads/generate  (POST)
//
// Body: { productId, prompt, format: "1:1"|"9:16"|"16:9", count }
//
// Phase 1 runs synchronously: Director (Gemini) → N scene concepts →
// Bria Product Shot per scene (parallel) → persist outputs to storage →
// ad_assets rows → return the generated ads. Image gen is fast enough to
// await inline; video/queue+webhook arrives in a later phase.

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { directAdScenes } from "@/lib/ai-ads/director";
import { AD_MODELS, FORMAT_DIMS, FORMAT_IDS } from "@/lib/ai-ads/generate-image";
import { lockedComposite } from "@/lib/ai-ads/locked-composite";
import { evaluateFidelity } from "@/lib/ai-ads/evaluator";

const BUCKET = "ad-studio";
const FORMATS = FORMAT_IDS;

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  ad_product_images: Array<{ storage_path: string; cutout_path: string | null; is_primary: boolean }>;
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const body = (await req.json()) as {
      productId?: string;
      prompt?: string;
      format?: string;
      count?: number;
      model?: string;
      scene?: string;
      formats?: string[];
    };

    const productId = String(body.productId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const format = FORMATS.includes(body.format ?? "") ? (body.format as string) : "1:1";
    const count = Math.min(Math.max(Number(body.count) || 3, 1), 6);
    const runner = AD_MODELS.find((m) => m.id === body.model) ?? AD_MODELS[0];
    const fixedScene =
      typeof body.scene === "string" && body.scene.trim() ? body.scene.trim() : null;
    if (!productId || (!prompt && !fixedScene)) {
      return NextResponse.json({ error: "Product and prompt are required" }, { status: 400 });
    }

    // Load product + primary image (RLS-scoped to the caller's account).
    const { data, error } = await ctx.supabase
      .from("ad_products")
      .select("id, name, description, ad_product_images(storage_path, cutout_path, is_primary)")
      .eq("id", productId)
      .maybeSingle();
    if (error) throw error;
    const product = data as ProductRow | null;
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const imgs = product.ad_product_images ?? [];
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    if (!primary) return NextResponse.json({ error: "Product has no image" }, { status: 400 });
    const productUrl = ctx.supabase.storage
      .from(BUCKET)
      .getPublicUrl(primary.cutout_path ?? primary.storage_path).data.publicUrl;

    const locked = body.model === "locked";
    const cutoutUrl = primary.cutout_path
      ? ctx.supabase.storage.from(BUCKET).getPublicUrl(primary.cutout_path).data.publicUrl
      : null;
    if (locked && !cutoutUrl) {
      return NextResponse.json(
        { error: "Re-upload this product so we can isolate it for locked mode." },
        { status: 400 },
      );
    }

    // Multi-format batch: one scene rendered across several aspect ratios.
    const formatsList =
      Array.isArray(body.formats) && body.formats.length
        ? body.formats.filter((f) => FORMATS.includes(f))
        : null;
    const multi = !!formatsList && formatsList.length > 1;
    const sceneCount = multi ? 1 : count;

    // "More like this" reuses one scene; otherwise the Director writes N.
    const scenes = fixedScene
      ? Array.from({ length: sceneCount }, (_, i) => ({
          label: `Variation ${i + 1}`,
          scene: fixedScene,
        }))
      : await directAdScenes({
          productName: product.name,
          productDescription: product.description,
          prompt,
          count: sceneCount,
        });

    // The unit of work: each entry = one image to render (scene + format).
    const tasks = multi
      ? formatsList!.map((f) => ({ scene: scenes[0].scene, format: f, label: f }))
      : scenes.map((s) => ({ scene: s.scene, format, label: s.label }));

    const admin = supabaseAdmin();
    const { data: job, error: jobErr } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        product_id: productId,
        type: "image",
        prompt: prompt || fixedScene,
        brief: { scenes },
        format,
        status: "processing",
        model: locked ? "locked" : runner.id,
      })
      .select("id")
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id as string;

    // Generate one ad per scene, in parallel; persist each output.
    const results = await Promise.all(
      tasks.map(async (t, i) => {
        try {
          let bytes: Uint8Array;
          if (locked) {
            const out = await lockedComposite({
              scene: t.scene,
              cutoutUrl: cutoutUrl!,
              format: t.format,
            });
            bytes = new Uint8Array(out);
          } else {
            const [falUrl] = await runner.run({
              imageUrl: productUrl,
              scene: t.scene,
              format: t.format,
            });
            if (!falUrl) throw new Error("no image returned");
            bytes = new Uint8Array(await (await fetch(falUrl)).arrayBuffer());
          }

          // Evaluator loop: vision-check product fidelity, retry once on drift.
          let fidelity: number | null = null;
          let retried = false;
          if (!locked) {
            const verdict = await evaluateFidelity({
              productUrl,
              generated: bytes,
              productName: product.name,
            });
            fidelity = verdict.score;
            if (!verdict.pass) {
              retried = true;
              const stricter = `${t.scene}\n\nCRITICAL: keep the product EXACTLY as the reference — identical shape, colour, label and logo. Do NOT add, remove, or alter any text, logo, or graphic. Fix these problems from the previous attempt: ${verdict.issues || "the product was altered"}.`;
              try {
                const [retryUrl] = await runner.run({
                  imageUrl: productUrl,
                  scene: stricter,
                  format: t.format,
                });
                if (retryUrl) bytes = new Uint8Array(await (await fetch(retryUrl)).arrayBuffer());
              } catch (e) {
                console.error("[ai-ads/generate] evaluator retry failed:", e);
              }
            }
          }

          // Normalise to the exact target dimensions so every format is a true
          // distinct size, regardless of the model's native output.
          const [tw, th] = FORMAT_DIMS[t.format] ?? [1024, 1024];
          bytes = new Uint8Array(
            await sharp(Buffer.from(bytes)).resize(tw, th, { fit: "cover" }).png().toBuffer(),
          );

          const path = `outputs/${ctx.accountId}/${jobId}/${i}.png`;
          const up = await admin.storage
            .from(BUCKET)
            .upload(path, bytes, { contentType: "image/png", upsert: true });
          if (up.error) throw up.error;
          const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          const { data: assetRow } = await admin
            .from("ad_assets")
            .insert({
              account_id: ctx.accountId,
              job_id: jobId,
              type: "image",
              storage_path: path,
              variation_index: i,
              metadata: {
                scene: t.scene,
                label: t.label,
                model: locked ? "locked" : runner.id,
                format: t.format,
                fidelity,
                retried,
              },
            })
            .select("id")
            .single();
          return {
            id: assetRow?.id as string,
            url,
            label: t.label,
            scene: t.scene,
            favorite: false,
          };
        } catch (e) {
          console.error("[ai-ads/generate] variation failed:", e);
          return null;
        }
      }),
    );

    const assets = results.filter(
      (a): a is { id: string; url: string; label: string; scene: string; favorite: boolean } => !!a,
    );
    await admin
      .from("ad_jobs")
      .update({
        status: assets.length ? "completed" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (!assets.length) {
      return NextResponse.json({ error: "Generation failed — try again" }, { status: 502 });
    }
    return NextResponse.json({ jobId, assets });
  } catch (err) {
    return toErrorResponse(err);
  }
}
