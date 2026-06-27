// /api/ai-ads/enhance — run the AI director WITHOUT generating, and return the full
// prompt that WOULD be sent to the model, so the composer can preview/edit it first.
//   image           → directImage  → one editable prompt
//   video (single)  → directCinematic → editable video_prompt (+ keyframe)
//   video (cuts)    → directCuts → read-only sequence (style header + N shots)
// Cheap: one Gemini call, no fal spend.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { directImage } from "@/lib/ai-ads/image-director";
import { directCinematic, directCuts, type Subject } from "@/lib/ai-ads/cinematic-director";
import { resolveSkill } from "@/lib/ai-ads/resolve-skill";
import { skillAddendum } from "@/lib/ai-ads/skills";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveSubjects(admin: SupabaseClient, accountId: string, soulIds: string[], prompt: string) {
  const handles = [...prompt.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase());
  const { data } = await admin
    .from("ad_soul_ids")
    .select("id, handle, name, kind")
    .eq("account_id", accountId);
  const all = (data ?? []) as Array<{ id: string; handle: string; name: string; kind: string }>;
  const chosen = all
    .filter((s) => soulIds.includes(s.id) || handles.includes(String(s.handle).toLowerCase()))
    .slice(0, 4);
  const nameByHandle: Record<string, string> = {};
  chosen.forEach((s) => (nameByHandle[String(s.handle).toLowerCase()] = s.name));
  return { chosen, nameByHandle };
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const kind = body.kind === "video" ? "video" : "image";
    const prompt = String(body.prompt ?? "").trim().slice(0, 5000);
    if (!prompt) return NextResponse.json({ error: "Type a prompt first" }, { status: 400 });
    const mood = String(body.mood ?? "auto").slice(0, 40);
    const aspect = String(body.aspect ?? (kind === "video" ? "9:16" : "1:1"));
    const soulIds = Array.isArray(body.soulIds) ? (body.soulIds as unknown[]).filter((x) => typeof x === "string") as string[] : [];
    const skillId = String(body.skillId ?? "").trim() || null;

    const skill = await resolveSkill(admin, skillId, ctx.accountId);
    const skillText = skill ? skillAddendum(skill) : undefined;
    const { chosen, nameByHandle } = await resolveSubjects(admin, ctx.accountId, soulIds, prompt);
    const cleanPrompt = prompt.replace(/@([a-zA-Z0-9_-]+)/g, (_, h: string) => nameByHandle[h.toLowerCase()] ?? h);

    if (kind === "video") {
      const engine = String(body.engine ?? "seedance-fast");
      const duration = Math.min(Math.max(Math.round(Number(body.duration) || 5), 3), 15);
      const cuts = body.cuts === true;
      const adMode =
        mood === "commercial" ||
        mood === "ugc" ||
        /\b(ad|advert|advertis|commercial|promo|product|brand|ugc|unboxing)\b/i.test(cleanPrompt)
          ? "ad"
          : "cinematic";
      const minShot = engine === "kling-pro" ? 3 : engine === "kling-turbo" ? 5 : 4;
      const promptBudget = engine.startsWith("kling") ? 2400 : 5000;
      const useReference = engine.startsWith("seedance") && chosen.length > 0;
      const subjects: Subject[] | undefined = chosen.length
        ? chosen.map((c, i) => ({ tag: useReference ? `@Image${i + 1}` : c.name, desc: c.name, kind: c.kind }))
        : undefined;

      if (cuts && duration >= minShot * 2) {
        const seq = await directCuts({ prompt: cleanPrompt, duration, minShot, aspect, mode: adMode, mood, subjects, skill: skillText, promptBudget });
        const full =
          `${seq.styleHeader}\n\n` +
          seq.shots
            .map((s, i) => `— SHOT ${i + 1} · ${s.transition} · ${s.durationSec}s —\n${s.videoPrompt}`)
            .join("\n\n");
        return NextResponse.json({ editable: false, mode: "video-cuts", prompt: full });
      }

      const shot = await directCinematic({ prompt: cleanPrompt, duration, aspect, mode: adMode, mood, subjects, skill: skillText, promptBudget });
      return NextResponse.json({ editable: true, mode: "video", prompt: shot.videoPrompt, keyframe: shot.keyframePrompt });
    }

    // image
    const subjects = chosen.length ? chosen.map((c) => ({ tag: c.name, desc: c.name, kind: c.kind })) : undefined;
    const enhanced = await directImage({ prompt: cleanPrompt, mood, aspect, subjects, skill: skillText });
    return NextResponse.json({ editable: true, mode: "image", prompt: enhanced });
  } catch (err) {
    return toErrorResponse(err);
  }
}
