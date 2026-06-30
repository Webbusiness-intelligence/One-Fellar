// GET /api/social/posts — this account's scheduled/posted history.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("scheduled_posts")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
