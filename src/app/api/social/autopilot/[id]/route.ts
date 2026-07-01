// PATCH  /api/social/autopilot/[id] — toggle active (or edit).
// DELETE /api/social/autopilot/[id] — remove a rule.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { id } = await params;
    const b = (await req.json()) as { active?: boolean };
    const patch: Record<string, unknown> = {};
    if (typeof b.active === "boolean") patch.active = b.active;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const { data, error } = await admin
      .from("autopilot_rules")
      .update(patch)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ rule: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { id } = await params;
    const { error } = await admin.from("autopilot_rules").delete().eq("id", id).eq("account_id", ctx.accountId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
