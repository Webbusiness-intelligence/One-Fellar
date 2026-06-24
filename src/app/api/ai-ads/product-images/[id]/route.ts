// /api/ai-ads/product-images/[id]
//   PATCH  — make this photo the product's primary
//   DELETE — remove a product photo (storage + row); promote another if it
//            was the primary

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const BUCKET = "ad-studio";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const { data: img, error } = await ctx.supabase
      .from("ad_product_images")
      .select("id, product_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const admin = supabaseAdmin();
    await admin.from("ad_product_images").update({ is_primary: false }).eq("product_id", img.product_id);
    await admin.from("ad_product_images").update({ is_primary: true }).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const { data: img, error } = await ctx.supabase
      .from("ad_product_images")
      .select("id, product_id, storage_path, is_primary")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const admin = supabaseAdmin();
    await admin.storage.from(BUCKET).remove([img.storage_path]);
    await admin.from("ad_product_images").delete().eq("id", id);

    if (img.is_primary) {
      const { data: rest } = await admin
        .from("ad_product_images")
        .select("id")
        .eq("product_id", img.product_id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (rest && rest[0]) {
        await admin.from("ad_product_images").update({ is_primary: true }).eq("id", rest[0].id);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
