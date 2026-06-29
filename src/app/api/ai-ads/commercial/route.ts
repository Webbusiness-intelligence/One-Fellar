// /api/ai-ads/commercial  (POST, JSON)
// Body: { assetId, chatId?, sceneShots?, shotDuration?, brief? }
// Builds a multi-shot CINEMATIC COMMERCIAL from one ad: storyboard (vision) →
// per-shot keyframes (gpt-image, product kept consistent) → Kling v3 Pro per shot
// (rendered in parallel) → ffmpeg stitch → one film. The original ad becomes the
// closing brand end-card. Persists a video asset + an assistant chat message.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildStoryboard } from "@/lib/ai-ads/video-storyboard";
import { gptImageEdit } from "@/lib/ai-ads/chat-models";
import { klingImageToVideo } from "@/lib/ai-ads/video-models";
import { stitchVideos } from "@/lib/ai-ads/stitch";
import { mapLimit } from "@/lib/ai-ads/batch";

const BUCKET = "ad-studio";
const DURATIONS = [3, 5, 10];

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const body = (await req.json()) as {
      assetId?: string;
      chatId?: string;
      sceneShots?: number;
      shotDuration?: number;
      brief?: string;
    };
    const assetId = String(body.assetId ?? "");
    const chatId = body.chatId ? String(body.chatId) : null;
    const sceneShots = Math.min(Math.max(Number(body.sceneShots) || 3, 2), 4);
    const shotDuration = DURATIONS.includes(Number(body.shotDuration)) ? Number(body.shotDuration) : 5;
    const brief = String(body.brief ?? "").trim().slice(0, 400);
    if (!assetId) return NextResponse.json({ error: "No image to build from" }, { status: 400 });

    const { data: src } = await admin
      .from("ad_assets")
      .select("storage_path, metadata")
      .eq("id", assetId)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!src) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    const startUrl = pub(src.storage_path as string);
    const aspect = (src.metadata as { aspect?: string })?.aspect || "4:5";
    const label = (src.metadata as { prompt?: string })?.prompt ?? "Ad";

    // 1) Storyboard (vision → bible + cinematic shot list).
    const sb = await buildStoryboard({ imageUrl: startUrl, brief, sceneShots, shotDuration });
    console.log(`[ai-ads/commercial] storyboard: ${sb.shots.length} scenes | bible: ${sb.bible}`);

    // 2) Keyframes — generate each shot's start frame with the exact product (gpt-image),
    //    falling back to the source ad if a frame fails.
    const kf = (scene: string) =>
      `${scene}. The product shown in the reference image is the HERO — reproduce it EXACTLY (same form, label and branding); do not add ad headlines, logos or CTA text. Cinematic, premium commercial photography. Keep the whole composition inside the frame.`;
    const keyframeUrls = await mapLimit(sb.shots, 3, async (shot) => {
      for (let a = 0; a < 2; a++) {
        try {
          const u = await gptImageEdit({
            prompt: kf(shot.keyframePrompt),
            imageUrls: [startUrl],
            format: aspect,
            quality: "medium",
            num: 1,
          });
          if (u[0]) return u[0];
        } catch (e) {
          console.error("[ai-ads/commercial] keyframe failed:", e);
        }
      }
      return startUrl;
    });

    // 3) Assemble the shot list: scenes + the original ad as a brand end-card.
    const shots = [
      ...sb.shots.map((shot, i) => ({
        imageUrl: keyframeUrls[i],
        prompt: shot.motionPrompt,
        summary: shot.summary,
      })),
      {
        imageUrl: startUrl,
        prompt:
          "Elegant premium brand end-card: a slow, gentle push-in that settles and holds on the product, logo and call-to-action; keep ALL text crisp, legible and perfectly stable; refined cinematic colour grade; a subtle, satisfying music swell to close.",
        summary: "Brand end-card",
      },
    ];

    // 4) Render every shot with Kling (in parallel via the fal queue).
    const clipResults = await mapLimit(shots, 4, async (s) => {
      for (let a = 0; a < 2; a++) {
        try {
          const u = await klingImageToVideo({
            startImageUrl: s.imageUrl,
            prompt: s.prompt,
            negativePrompt: sb.negativePrompt,
            duration: shotDuration,
            audio: true,
          });
          if (u) return u;
        } catch (e) {
          console.error(`[ai-ads/commercial] shot "${s.summary}" failed:`, e);
        }
      }
      return null;
    });
    const clips = clipResults.filter((u): u is string => !!u);
    console.log(`[ai-ads/commercial] rendered ${clips.length}/${shots.length} shots`);
    if (!clips.length) {
      return NextResponse.json({ error: "The commercial didn't render — try again." }, { status: 502 });
    }

    // 5) Stitch into one film.
    const finalMp4 = await stitchVideos(clips);
    console.log(`[ai-ads/commercial] stitched ${clips.length} clips → ${finalMp4.length} bytes`);

    // 6) Persist + post to the chat.
    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "video",
        prompt: sb.bible,
        status: "completed",
        model: "commercial",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const path = `outputs/${ctx.accountId}/${jobId}/0.mp4`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, finalMp4, { contentType: "video/mp4", upsert: true });
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
          model: "commercial",
          summary: sb.bible,
          shots: clips.length,
          duration: clips.length * shotDuration,
          source_asset: assetId,
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
    const caption = `Here's your ${clips.length}-shot cinematic commercial — ${sb.bible}.`;
    const suggestions = ["Add more shots", "Punchier pacing", "Make it 10s shots"];

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
          metadata: { model: "commercial", suggestions },
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
