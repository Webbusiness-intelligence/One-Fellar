// GET /api/social/assets — recent generated images for this account, as public URLs
// (the ad-studio bucket is public), so they can be picked + posted to socials.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "ad-studio";
export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("ad_assets")
      .select("id, storage_path, metadata, created_at")
      .eq("account_id", ctx.accountId)
      .eq("type", "image")
      .order("created_at", { ascending: false })
      .limit(18);
    if (error) throw error;

    const assets = (data ?? [])
      .filter((a) => !(a.metadata as { soulCandidate?: boolean } | null)?.soulCandidate)
      .map((a) => ({
        id: a.id as string,
        url: admin.storage.from(BUCKET).getPublicUrl(a.storage_path as string).data.publicUrl,
      }));
    return NextResponse.json({ assets });
  } catch (err) {
    return toErrorResponse(err);
  }
}
