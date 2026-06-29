// /api/ai-ads/assets/[id]
//   PATCH  — toggle the favorite flag on a generated ad
//   DELETE — delete a generated ad (row + storage file)

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "ad-studio";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const body = (await req.json()) as { favorite?: boolean };
    const favorite = !!body.favorite;

    const { data, error } = await ctx.supabase
      .from("ad_assets")
      .update({ favorite })
      .eq("id", id)
      .select("id, favorite")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ favorite: data.favorite });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");

    const { data: asset, error } = await ctx.supabase
      .from("ad_assets")
      .select("id, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const admin = supabaseAdmin();
    await admin.storage.from(BUCKET).remove([asset.storage_path]);
    await admin.from("ad_assets").delete().eq("id", id).eq("account_id", ctx.accountId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
