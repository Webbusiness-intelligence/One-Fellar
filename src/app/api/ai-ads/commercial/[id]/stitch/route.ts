// /api/ai-ads/commercial/[id]/stitch  (POST)
// Stitches the LOCKED scenes (in order) into the final film via ffmpeg, stores it
// as a video asset, and marks the project completed. Only locked scenes are used.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stitchVideos, muxTracks, probeDuration } from "@/lib/ai-ads/stitch";
import { generateMusic, textToSpeech } from "@/lib/ai-ads/audio-models";
import { writeVoiceover } from "@/lib/ai-ads/voiceover";

const BUCKET = "ad-studio";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const { data: project } = await admin
      .from("ad_commercials")
      .select("title, brief, bible")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const bible = (project.bible as {
      text?: string;
      storyline?: string;
      music?: boolean;
      musicVibe?: string;
      voiceover?: boolean;
      voVoice?: string;
    }) ?? {};

    const { data: scenes } = await admin
      .from("ad_commercial_scenes")
      .select("idx, locked, locked_asset_id, duration")
      .eq("commercial_id", id)
      .eq("locked", true)
      .order("idx", { ascending: true });

    const lockedIds = (scenes ?? [])
      .map((s) => s.locked_asset_id as string | null)
      .filter((x): x is string => !!x);
    if (!lockedIds.length) {
      return NextResponse.json({ error: "Lock at least one scene first" }, { status: 400 });
    }

    // Resolve locked clip urls, preserving scene order.
    const { data: assets } = await admin
      .from("ad_assets")
      .select("id, storage_path")
      .in("id", lockedIds);
    const urlById = new Map((assets ?? []).map((a) => [a.id as string, pub(a.storage_path as string)]));
    const clipUrls = lockedIds.map((aid) => urlById.get(aid)).filter((u): u is string => !!u);
    if (!clipUrls.length) {
      return NextResponse.json({ error: "Locked clips not found" }, { status: 400 });
    }

    await admin.from("ad_commercials").update({ status: "rendering" }).eq("id", id);
    let finalMp4 = await stitchVideos(clipUrls);

    // Post: music bed + voiceover, mixed under the film's own SFX.
    const plannedDur = (scenes ?? []).reduce((s, x) => s + (Number(x.duration) || 5), 0);
    const totalDur = (await probeDuration(finalMp4)) || plannedDur; // real length (engines may round)
    const tracks: Array<{ url: string; volume: number }> = [];
    if (bible.music) {
      try {
        const m = await generateMusic({
          prompt: `${bible.musicVibe || "premium cinematic commercial"} instrumental score, no vocals, tasteful and brand-appropriate, builds to an uplifting close; mood: ${bible.text || "aspirational"}`,
          duration: totalDur,
        });
        if (m) tracks.push({ url: m, volume: 0.3 });
      } catch (e) {
        console.error("[ai-ads/commercial] music failed:", e);
      }
    }
    if (bible.voiceover) {
      try {
        const script = await writeVoiceover({
          storyline: bible.storyline || "",
          bible: bible.text,
          brief: project.brief as string,
          duration: totalDur,
        });
        if (script) {
          const vo = await textToSpeech({ text: script, voice: bible.voVoice });
          if (vo) tracks.push({ url: vo, volume: 1.0 });
        }
      } catch (e) {
        console.error("[ai-ads/commercial] voiceover failed:", e);
      }
    }
    if (tracks.length) finalMp4 = await muxTracks(finalMp4, tracks, bible.voiceover ? 0.3 : 0.6);
    console.log(
      `[ai-ads/commercial] stitch ${id} | ${clipUrls.length} scenes | music:${bible.music ? "y" : "n"} vo:${bible.voiceover ? "y" : "n"} → ${finalMp4.length} bytes`,
    );

    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        type: "video",
        prompt: (project.title as string) ?? "Commercial",
        status: "completed",
        model: "commercial",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    const path = `outputs/${ctx.accountId}/${jobId}/final.mp4`;
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
        metadata: { model: "commercial", commercial: id, scenes: clipUrls.length },
      })
      .select("id")
      .single();

    await admin
      .from("ad_commercials")
      .update({ final_asset_id: asset!.id, status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ asset: { id: asset!.id as string, url: pub(path) } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
