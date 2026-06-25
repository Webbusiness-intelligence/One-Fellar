// /api/ai-ads/skills/from-asset — POST { assetId }. Learns a reusable SKILL from a
// generated result: distils ONLY the look/style (lighting, lens, grade, texture,
// mood) from the asset's prompt — subject stripped — via Gemini, then saves it as a
// custom skill. Fail-open: if Gemini is unavailable, stores the raw prompt as recipe.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import type { Skill } from "@/lib/ai-ads/skills";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "skill"
  );
}

type Draft = { name: string; icon: string; recipe: string; negative: string };

async function distill(prompt: string): Promise<Draft> {
  const fb: Draft = { name: "Custom Look", icon: "✨", recipe: prompt.slice(0, 600), negative: "" };
  if (!GEMINI_API_KEY) return fb;
  const instruction = `From this image-generation prompt, extract ONLY the reusable LOOK / STYLE as a skill recipe — the lighting, lens / focal length, colour grade + film stock, texture, mood and composition — and STRIP OUT the specific subject, product, person and scene so the look can be reused on ANYTHING.

PROMPT: "${prompt}"

Return STRICT JSON only: {"name":"a short 2-4 word name for the look","icon":"one relevant emoji","recipe":"1-3 sentences describing ONLY the look/style, no subject","negative":"a few things to avoid, comma-separated"}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
        }),
      },
    );
    if (!res.ok) return fb;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(raw) as Partial<Draft>;
    return {
      name: (p.name || fb.name).slice(0, 60),
      icon: (p.icon || "✨").slice(0, 8),
      recipe: (p.recipe || fb.recipe).slice(0, 1200),
      negative: (p.negative || "").slice(0, 400),
    };
  } catch {
    return fb;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { assetId } = (await req.json().catch(() => ({}))) as { assetId?: string };
    if (!assetId) return NextResponse.json({ error: "Missing asset" }, { status: 400 });

    const { data: asset } = await admin
      .from("ad_assets")
      .select("metadata")
      .eq("id", assetId)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const meta = (asset.metadata ?? {}) as { genPrompt?: string; prompt?: string };
    const source = (meta.genPrompt || meta.prompt || "").trim();
    if (!source) return NextResponse.json({ error: "No prompt to learn from" }, { status: 400 });

    const d = await distill(source);

    let slug = slugify(d.name);
    const { data: existing } = await admin.from("ad_skills").select("slug").eq("account_id", ctx.accountId);
    const taken = new Set((existing ?? []).map((r) => String(r.slug).toLowerCase()));
    if (taken.has(slug)) {
      let n = 2;
      while (taken.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }

    const { data: row, error } = await admin
      .from("ad_skills")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        slug,
        name: d.name,
        icon: d.icon,
        kind: "both",
        recipe: d.recipe,
        negative: d.negative || null,
        defaults: {},
      })
      .select("id, name, icon, kind, recipe, negative")
      .single();
    if (error) throw error;

    const skill: Skill = {
      id: row.id as string,
      name: row.name as string,
      icon: (row.icon as string) ?? "✨",
      kind: "both",
      recipe: row.recipe as string,
      negative: (row.negative as string) ?? undefined,
      defaults: {},
      builtin: false,
    };
    console.log(`[ai-ads/skills] learned "${skill.name}" from asset for ${ctx.accountId}`);
    return NextResponse.json({ skill });
  } catch (err) {
    return toErrorResponse(err);
  }
}
