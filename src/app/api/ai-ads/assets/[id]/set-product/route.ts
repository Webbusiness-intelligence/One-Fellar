// /api/ai-ads/assets/[id]/set-product  (POST)
// Promotes a generated ad to be its product's primary reference image, so the
// next generation builds on it. Copies the file into the product's images.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const BUCKET = "ad-studio";

interface AssetRow {
  id: string;
  storage_path: string;
  ad_jobs: { product_id: string | null } | { product_id: string | null }[] | null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");

    const { data, error } = await ctx.supabase
      .from("ad_assets")
      .select("id, storage_path, ad_jobs!inner(product_id)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    const asset = data as AssetRow | null;
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const job = Array.isArray(asset.ad_jobs) ? asset.ad_jobs[0] : asset.ad_jobs;
    const productId = job?.product_id;
    if (!productId) return NextResponse.json({ error: "Ad has no product" }, { status: 400 });

    const admin = supabaseAdmin();
    const srcUrl = admin.storage.from(BUCKET).getPublicUrl(asset.storage_path).data.publicUrl;
    const bytes = new Uint8Array(await (await fetch(srcUrl)).arrayBuffer());
    const path = `products/${ctx.accountId}/${productId}/${randomUUID()}.png`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;

    await admin.from("ad_product_images").update({ is_primary: false }).eq("product_id", productId);
    const ins = await admin.from("ad_product_images").insert({
      account_id: ctx.accountId,
      product_id: productId,
      storage_path: path,
      is_primary: true,
    });
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
