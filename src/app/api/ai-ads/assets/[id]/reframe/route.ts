// /api/ai-ads/assets/[id]/reframe  (POST)
// Body: { format }  → outpaints the asset to a new aspect ratio and stores the
// result as a new asset (so one hero image becomes a full platform set).

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { reframeImage } from "@/lib/ai-ads/reframe";
import { FORMAT_IDS } from "@/lib/ai-ads/generate-image";

const BUCKET = "ad-studio";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const body = (await req.json()) as { format?: string };
    const format = FORMAT_IDS.includes(body.format ?? "") ? (body.format as string) : null;
    if (!format) return NextResponse.json({ error: "Pick a size" }, { status: 400 });

    const { data: asset, error } = await ctx.supabase
      .from("ad_assets")
      .select("id, storage_path, metadata")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const admin = supabaseAdmin();
    const srcUrl = admin.storage.from(BUCKET).getPublicUrl(asset.storage_path).data.publicUrl;
    const outUrl = await reframeImage(srcUrl, format);
    if (!outUrl) return NextResponse.json({ error: "Reframe failed — try again" }, { status: 502 });

    const label = ((asset.metadata as { prompt?: string })?.prompt ?? "Reframed").slice(0, 80);
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "image",
        prompt: label,
        format,
        status: "completed",
        model: "reframe",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const bytes = new Uint8Array(await (await fetch(outUrl)).arrayBuffer());
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
        metadata: { model: "reframe", prompt: label, format, chat: true },
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
