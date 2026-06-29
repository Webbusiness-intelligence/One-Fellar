// /api/ai-ads/compare  (POST)
//
// Body: { productId, prompt, format }
//
// Runs the SAME product + the SAME Director scene through every model in
// AD_MODELS (Bria, Nano Banana, Seedream) so the user can judge which is best
// for their catalog. One scene → fair comparison.

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { directAdScenes } from "@/lib/ai-ads/director";
import { COMPARE_MODELS, FORMAT_DIMS, FORMAT_IDS } from "@/lib/ai-ads/generate-image";

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
    const body = (await req.json()) as { productId?: string; prompt?: string; format?: string };
    const productId = String(body.productId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const format = FORMATS.includes(body.format ?? "") ? (body.format as string) : "1:1";
    if (!productId || !prompt) {
      return NextResponse.json({ error: "Product and prompt are required" }, { status: 400 });
    }

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

    const scenes = await directAdScenes({
      productName: product.name,
      productDescription: product.description,
      prompt,
      count: 1,
    });
    const scene = scenes[0].scene;

    const admin = supabaseAdmin();
    const { data: job, error: jobErr } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        product_id: productId,
        type: "image",
        prompt,
        brief: { scene, compare: true },
        format,
        status: "processing",
        model: "compare",
      })
      .select("id")
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id as string;

    const results = await Promise.all(
      COMPARE_MODELS.map(async (m, i) => {
        try {
          const [falUrl] = await m.run({ imageUrl: productUrl, scene, format });
          if (!falUrl) throw new Error("no image returned");
          let bytes = new Uint8Array(await (await fetch(falUrl)).arrayBuffer());
          const [cw, ch] = FORMAT_DIMS[format] ?? [1024, 1024];
          bytes = new Uint8Array(
            await sharp(Buffer.from(bytes)).resize(cw, ch, { fit: "cover" }).png().toBuffer(),
          );
          const path = `outputs/${ctx.accountId}/${jobId}/${m.id}.png`;
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
              metadata: { model: m.id, label: m.label, scene },
            })
            .select("id")
            .single();
          return { id: assetRow?.id as string, model: m.id, label: m.label, url, favorite: false };
        } catch (e) {
          console.error(`[ai-ads/compare] ${m.id} failed:`, e);
          return { model: m.id, label: m.label, url: null };
        }
      }),
    );

    const anyOk = results.some((r) => r.url);
    await admin
      .from("ad_jobs")
      .update({ status: anyOk ? "completed" : "failed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    return NextResponse.json({ scene, results });
  } catch (err) {
    return toErrorResponse(err);
  }
}
