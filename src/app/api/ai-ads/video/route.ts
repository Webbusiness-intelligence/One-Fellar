// /api/ai-ads/video  (POST, JSON)
// Body: { assetId, chatId?, duration?, brief? }
// Animates an existing ad image into a high-end cinematic clip: a vision "director"
// writes the billion-dollar motion prompt, then Kling v3 Pro (image-to-video, with
// native audio) renders it. Persists a video asset + an assistant chat message.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildVideoBrief } from "@/lib/ai-ads/video-director";
import { klingImageToVideo } from "@/lib/ai-ads/video-models";

const BUCKET = "ad-studio";
const DURATIONS = [3, 5, 10, 15];

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const body = (await req.json()) as {
      assetId?: string;
      chatId?: string;
      duration?: number;
      brief?: string;
    };
    const assetId = String(body.assetId ?? "");
    const chatId = body.chatId ? String(body.chatId) : null;
    const duration = DURATIONS.includes(Number(body.duration)) ? Number(body.duration) : 10;
    const brief = String(body.brief ?? "").trim().slice(0, 400);
    if (!assetId) return NextResponse.json({ error: "No image to animate" }, { status: 400 });

    // Resolve the source ad image (must belong to the account).
    const { data: src } = await admin
      .from("ad_assets")
      .select("storage_path, metadata")
      .eq("id", assetId)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!src) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    const startUrl = pub(src.storage_path as string);
    const label = (src.metadata as { prompt?: string })?.prompt ?? "Ad";

    // 1) Direct the shot (vision → cinematic motion prompt).
    const directed = await buildVideoBrief({ imageUrl: startUrl, brief, duration });

    // 2) Render with Kling v3 Pro (native audio).
    let videoUrl: string | null = null;
    try {
      videoUrl = await klingImageToVideo({
        startImageUrl: startUrl,
        prompt: directed.prompt,
        negativePrompt: directed.negativePrompt,
        duration,
        audio: true,
      });
    } catch (e) {
      console.error("[ai-ads/video] render failed:", e);
    }
    console.log(`[ai-ads/video] kling v3 pro | ${duration}s | "${directed.summary}" → ${videoUrl ? "ok" : "failed"}`);

    if (!videoUrl) {
      return NextResponse.json(
        { error: "The video didn't render — please try again." },
        { status: 502 },
      );
    }

    // 3) Persist a job + the video asset.
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "video",
        prompt: directed.summary,
        status: "completed",
        model: "video",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const bytes = new Uint8Array(await (await fetch(videoUrl)).arrayBuffer());
    const path = `outputs/${ctx.accountId}/${jobId}/0.mp4`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) throw up.error;

    const { data: asset } = await admin
      .from("ad_assets")
      .insert({
        account_id: ctx.accountId,
        job_id: jobId,
        type: "video",
        storage_path: path,
        variation_index: 0,
        metadata: {
          chat: true,
          model: "video",
          prompt: directed.prompt,
          summary: directed.summary,
          source_asset: assetId,
          duration,
        },
      })
      .select("id")
      .single();

    const videoAsset = {
      id: asset!.id as string,
      url: pub(path),
      label,
      favorite: false,
      type: "video" as const,
    };
    const caption = `Here's your cinematic clip — ${directed.summary}.`;
    const suggestions = ["Make it 15 seconds", "Try a different camera move", "Punchier, faster pacing"];

    // 4) Append to the chat (if any) so it shows in the conversation.
    let messageId: string | undefined;
    if (chatId) {
      const { data: am } = await admin
        .from("ad_chat_messages")
        .insert({
          account_id: ctx.accountId,
          chat_id: chatId,
          role: "assistant",
          text: caption,
          asset_ids: [videoAsset.id],
          metadata: { model: "video", suggestions },
        })
        .select("id")
        .single();
      messageId = am?.id as string | undefined;
      await admin.from("ad_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    }

    return NextResponse.json({
      chatId,
      message: {
        id: messageId ?? videoAsset.id,
        role: "assistant",
        text: caption,
        assets: [videoAsset],
        suggestions,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
