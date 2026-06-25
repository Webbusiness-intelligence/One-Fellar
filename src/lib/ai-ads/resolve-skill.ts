// Resolve a skill id — a built-in ("builtin:*") or a custom uuid — to a Skill.
// Built-ins come from code; custom ones from the account's ad_skills table. Used
// server-side by the chat route (Create) and the worker (Video) to fold a skill's
// recipe into the director. Pass the relevant service-role client as `admin`.
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBuiltinSkill, type Skill, type SkillKind } from "./skills";

export async function resolveSkill(
  admin: SupabaseClient,
  skillId: string | null | undefined,
  accountId: string,
): Promise<Skill | null> {
  if (!skillId) return null;
  const builtin = getBuiltinSkill(skillId);
  if (builtin) return builtin;

  const { data } = await admin
    .from("ad_skills")
    .select("id, name, icon, kind, recipe, negative, defaults")
    .eq("id", skillId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) return null;

  const r = data as {
    id: string;
    name: string;
    icon: string | null;
    kind: string;
    recipe: string;
    negative: string | null;
    defaults: Skill["defaults"] | null;
  };
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
