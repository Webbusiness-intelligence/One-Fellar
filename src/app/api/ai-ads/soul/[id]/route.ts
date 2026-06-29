// /api/ai-ads/soul/[id]  — DELETE a Soul ID (and its stored reference image).

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "ad-studio";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();

    const { data: row } = await admin
      .from("ad_soul_ids")
      .select("storage_path")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await admin.from("ad_soul_ids").delete().eq("id", id).eq("account_id", ctx.accountId);
    await admin.storage.from(BUCKET).remove([row.storage_path as string]).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
