// /api/ai-ads/assets/[id]/cutout  (POST)
// Removes the background → a transparent-PNG version of the asset, stored as a
// new asset (for compositing into other designs / decks).

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
      "fal-ai/bria/background/remove",
      { image_url: srcUrl },
    );
    const cutUrl = data.image?.url ?? data.images?.[0]?.url;
    if (!cutUrl) return NextResponse.json({ error: "Cutout failed — try again" }, { status: 502 });

    const label = `${((asset.metadata as { prompt?: string })?.prompt ?? "Cutout").slice(0, 70)} (PNG)`;
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "image",
        prompt: label,
        status: "completed",
        model: "cutout",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const bytes = new Uint8Array(await (await fetch(cutUrl)).arrayBuffer());
    const path = `outputs/${ctx.accountId}/${jobId}/0.png`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;

    const { data: newAsset } = await admin
      .from("ad_assets")
      .insert({
        account_id: ctx.accountId,
        job_id: jobId,
        type: "image",
        storage_path: path,
        metadata: { model: "cutout", prompt: label, transparent: true, chat: true },
      })
      .select("id")
      .single();

    return NextResponse.json({
      id: newAsset?.id,
      url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      label,
      favorite: false,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
