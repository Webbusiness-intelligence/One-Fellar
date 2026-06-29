// /api/ai-ads/jobs  (POST, multipart) — ENQUEUE a generation job.
// Returns instantly with { jobId }; the worker (npm run worker) does the render.
// Reserves credits up-front via reserve_and_enqueue (→ 402 if short). The job
// payload goes in ad_jobs.brief; the worker reads it (worker/run-video|run-image).
import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sceneCredits, chatCredits, FAL, toCredits, planLimits, clampQuality, clampResolution } from "@/lib/ai-ads/cost";

const BUCKET = "ad-studio";
const RESOLUTIONS = ["480p", "720p", "1080p", "4k"];

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
    // Free-tier gating: cap quality / resolution / count to the account's plan.
    const { data: planRow } = await admin
      .from("accounts")
      .select("plan")
      .eq("id", ctx.accountId)
      .maybeSingle();
    const plan = (planRow?.plan as string) ?? "free";
    const limits = planLimits(plan);

    const form = await req.formData();
    const kindRaw = String(form.get("kind") || "image");
    const kind = kindRaw === "video" || kindRaw === "soul" ? kindRaw : "image";
    const parseIds = (k: string): string[] => {
      try {
        const r = JSON.parse(String(form.get(k) ?? "[]"));
        return Array.isArray(r) ? r.filter((x) => typeof x === "string").slice(0, 4) : [];
      } catch {
        return [];
      }
    };

    let brief: Record<string, unknown>;
    let est: number;
    let fmt = "1:1";
    let chatId: string | undefined;

    if (kind === "video") {
      const prompt = String(form.get("prompt") ?? "").trim().slice(0, 5000);
      if (!prompt) return NextResponse.json({ error: "Describe the video" }, { status: 400 });
      const engine = String(form.get("engine") || "seedance-fast");
      const duration = Math.min(Math.max(Math.round(Number(form.get("duration")) || 5), 3), 15);
      const format = String(form.get("format") || "9:16");
      const resolution = clampResolution(
        plan,
        RESOLUTIONS.includes(String(form.get("resolution"))) ? String(form.get("resolution")) : "720p",
      );
      const audio = String(form.get("audio") ?? "true") !== "false";
      const count = Math.min(Math.max(Number(form.get("count")) || 1, 1), 4, limits.maxVariations);
      const cinematic = String(form.get("cinematic") ?? "true") !== "false";
      const mood = String(form.get("mood") ?? "auto").slice(0, 40);
      const cuts = String(form.get("cuts") ?? "false") === "true";
      const soulIds = parseIds("soulIds");
      const skillId = String(form.get("skillId") ?? "").trim() || null;
      const enhancedPrompt = String(form.get("enhancedPrompt") ?? "").trim().slice(0, 5000) || null;
      const enhancedKeyframe = String(form.get("enhancedKeyframe") ?? "").trim().slice(0, 2000) || null;

      // A start frame is uploaded now (brief is JSON) so the worker can fetch it.
      let startImageUrl: string | undefined;
      const file = form.get("file");
      if (file instanceof File && file.size) {
        const png = await sharp(Buffer.from(await file.arrayBuffer()))
          .rotate()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        const p = `video-src/${ctx.accountId}/${randomUUID()}.png`;
        const u = await admin.storage.from(BUCKET).upload(p, png, { contentType: "image/png", upsert: true });
        if (!u.error) startImageUrl = pub(p);
      }

      fmt = "9:16";
      brief = { prompt, engine, duration, format, resolution, audio, count, cinematic, mood, cuts, soulIds, skillId, enhancedPrompt, enhancedKeyframe, startImageUrl };
      est = count * sceneCredits({ duration, takes: 1, engine });
    } else if (kind === "soul") {
      const description = String(form.get("description") ?? "").trim().slice(0, 600);
      if (!description) return NextResponse.json({ error: "Describe what to create" }, { status: 400 });
      const soulKind = String(form.get("soulKind") ?? "character").slice(0, 20);
      const count = Math.min(Math.max(Number(form.get("count")) || 1, 1), 6, limits.maxVariations);
      const model = String(form.get("model")) === "gpt-image-2" ? "gpt-image-2" : "gpt-image-1.5";
      const quality = limits.maxImageQuality === "standard"
        ? "low"
        : (["low", "medium", "high"] as const).includes(String(form.get("quality")) as never)
          ? (String(form.get("quality")) as "low" | "medium" | "high")
          : "high";
      const refIds = parseIds("soulIds");
      let refUrls: string[] = [];
      if (refIds.length) {
        const { data } = await admin
          .from("ad_soul_ids")
          .select("storage_path")
          .in("id", refIds)
          .eq("account_id", ctx.accountId);
        refUrls = (data ?? []).map((s) => pub(s.storage_path as string));
      }
      fmt = "1:1";
      brief = { description, kind: soulKind, count, model, quality, refUrls };
      const per = quality === "high" ? FAL.gptImageHigh : quality === "medium" ? FAL.gptImageMedium : FAL.gptImageLow;
      est = toCredits(count * per);
    } else {
      // image (Create)
      const prompt = String(form.get("text") ?? form.get("prompt") ?? "").trim();
      if (!prompt) return NextResponse.json({ error: "Type a message" }, { status: 400 });
      const quality = clampQuality(
        plan,
        (["standard", "hd", "best"] as const).includes(String(form.get("quality")) as never)
          ? (String(form.get("quality")) as "standard" | "hd" | "best")
          : "standard",
      );
      const format = String(form.get("format") || "1:1");
      const variations = Math.min(Math.max(Number(form.get("variations")) || 1, 1), 8, limits.maxVariations);
      const realism = String(form.get("realism") ?? "true") !== "false";
      const mood = String(form.get("mood") ?? "auto").slice(0, 40);
      const soulIds = parseIds("soulIds");
      chatId = String(form.get("chatId") ?? "") || undefined;
      // Ensure a chat + persist the user's message so the thread reads correctly;
      // the worker appends the assistant message with the asset on completion.
      if (!chatId) {
        const { data: chat, error: cerr } = await admin
          .from("ad_chats")
          .insert({ account_id: ctx.accountId, created_by: ctx.userId, title: prompt.slice(0, 60) || "New chat" })
          .select("id")
          .single();
        if (cerr) throw cerr;
        chatId = chat!.id as string;
      }
      await admin
        .from("ad_chat_messages")
        .insert({ account_id: ctx.accountId, chat_id: chatId, role: "user", text: prompt });

      fmt = "1:1";
      brief = { prompt, quality, format, variations, realism, mood, soulIds, chatId };
      est = chatCredits({ variations, quality, isEdit: false, engine: "gpt" });
    }

    const { data: jid, error } = await admin.rpc("reserve_and_enqueue", {
      acct: ctx.accountId,
      creator: ctx.userId,
      est,
      payload: brief,
      jtype: kind,
      fmt,
    });
    if (error) {
      if (/insufficient_credits/i.test(error.message)) {
        return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
      }
      throw error;
    }

    return NextResponse.json({ jobId: jid, chatId, estimatedCredits: est });
  } catch (err) {
    return toErrorResponse(err);
  }
}
