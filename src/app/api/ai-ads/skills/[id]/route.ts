// /api/ai-ads/skills/[id]  — DELETE a custom skill (built-in skills aren't stored).

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    await admin.from("ad_skills").delete().eq("id", id).eq("account_id", ctx.accountId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
