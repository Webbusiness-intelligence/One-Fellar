// /api/ai-ads/skills
//   GET  — list skills available to the account: built-in library + custom ones.
//   POST — create a custom skill { name, recipe, kind?, icon?, negative?, defaults? }.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUILTIN_SKILLS, type Skill, type SkillKind } from "@/lib/ai-ads/skills";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "skill"
  );
}

type Row = {
  id: string;
  name: string;
  icon: string | null;
  kind: string;
  recipe: string;
  negative: string | null;
  defaults: Skill["defaults"] | null;
};

function toSkill(r: Row): Skill {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? "✨",
    kind: (["image", "video", "both"].includes(r.kind) ? r.kind : "both") as SkillKind,
    recipe: r.recipe,
    negative: r.negative ?? undefined,
    defaults: r.defaults ?? {},
    builtin: false,
  };
}

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("ad_skills")
      .select("id, name, icon, kind, recipe, negative, defaults")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false });
    const custom = (data ?? []).map((r) => toSkill(r as Row));
    return NextResponse.json({ builtin: BUILTIN_SKILLS, custom });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = String(body.name ?? "").trim().slice(0, 60);
    const recipe = String(body.recipe ?? "").trim().slice(0, 1200);
    if (!name) return NextResponse.json({ error: "Give it a name" }, { status: 400 });
    if (!recipe) return NextResponse.json({ error: "Describe the look / recipe" }, { status: 400 });

    const kind: SkillKind = (["image", "video", "both"] as const).includes(body.kind as SkillKind)
      ? (body.kind as SkillKind)
      : "both";
    const icon = String(body.icon ?? "✨").slice(0, 8);
    const negative = String(body.negative ?? "").trim().slice(0, 400) || null;
    const defaults =
      body.defaults && typeof body.defaults === "object" ? (body.defaults as Skill["defaults"]) : {};

    // Unique slug per account (slug of name, suffixed if taken).
    let slug = slugify(name);
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
        name,
        icon,
        kind,
        recipe,
        negative,
        defaults,
      })
      .select("id, name, icon, kind, recipe, negative, defaults")
      .single();
    if (error) throw error;

    console.log(`[ai-ads/skills] created "${name}" (${kind}) for ${ctx.accountId}`);
    return NextResponse.json({ skill: toSkill(row as Row) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
