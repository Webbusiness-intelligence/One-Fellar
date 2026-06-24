// /api/ai-ads/assets/[id]/upscale  (POST)
// Upscales a generated ad to high resolution (fal clarity-upscaler) and
// replaces the stored file in place. Returns a cache-busted URL.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { falRun } from "@/lib/ai-ads/fal";

const BUCKET = "ad-studio";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");

    const { data: asset, error } = await ctx.supabase
      .from("ad_assets")
      .select("id, storage_path, metadata")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const admin = supabaseAdmin();
    const srcUrl = admin.storage.from(BUCKET).getPublicUrl(asset.storage_path).data.publicUrl;

    const data = await falRun<{ image?: { url: string }; images?: Array<{ url: string }> }>(
      "fal-ai/clarity-upscaler",
      { image_url: srcUrl, upscale_factor: 2 },
    );
    const outUrl = data.image?.url ?? data.images?.[0]?.url;
    if (!outUrl) throw new Error("upscaler returned no image");

    const bytes = new Uint8Array(await (await fetch(outUrl)).arrayBuffer());
    const up = await admin.storage
      .from(BUCKET)
      .upload(asset.storage_path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;

    await admin
      .from("ad_assets")
      .update({ metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), upscaled: true } })
      .eq("id", id);

    const url =
      admin.storage.from(BUCKET).getPublicUrl(asset.storage_path).data.publicUrl + `?v=${Date.now()}`;
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return toErrorResponse(err);
  }
}
