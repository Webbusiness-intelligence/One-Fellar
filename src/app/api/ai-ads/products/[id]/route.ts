// /api/ai-ads/products/[id]
//   PATCH  — rename / edit a product (name, description)
//   DELETE — delete a product + its images + every generation + storage files
//
// Ownership is enforced by RLS on the verifying select; the heavy lifting
// (cascade deletes + storage cleanup) runs through the service role, scoped
// by account_id.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "ad-studio";

async function removeFolder(admin: SupabaseClient, folder: string) {
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
  if (files && files.length) {
    await admin.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const body = (await req.json()) as { name?: string; description?: string };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const description =
      body.description === undefined ? undefined : String(body.description ?? "").trim() || null;

    const update: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
    if (description !== undefined) update.description = description;

    const { data, error } = await ctx.supabase
      .from("ad_products")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");

    // Ownership check (RLS-scoped).
    const { data: product, error } = await ctx.supabase
      .from("ad_products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const admin = supabaseAdmin();

    // Storage cleanup: every job's outputs, plus the product's source images.
    const { data: jobs } = await admin
      .from("ad_jobs")
      .select("id")
      .eq("product_id", id)
      .eq("account_id", ctx.accountId);
    for (const j of jobs ?? []) {
      await removeFolder(admin, `outputs/${ctx.accountId}/${j.id}`);
    }
    await removeFolder(admin, `products/${ctx.accountId}/${id}`);

    // Rows: delete jobs (cascades ad_assets), then the product (cascades images).
    await admin.from("ad_jobs").delete().eq("product_id", id).eq("account_id", ctx.accountId);
    await admin.from("ad_products").delete().eq("id", id).eq("account_id", ctx.accountId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
