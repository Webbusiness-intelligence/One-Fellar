// /api/ai-ads/assets/[id]/prompt — GET the exact prompt that was sent to the model
// for a generated asset (stored in metadata: genPrompt for images, prompt for video).

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("viewer");
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("ad_assets")
      .select("metadata")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const m = (data.metadata ?? {}) as { genPrompt?: string; prompt?: string; model?: string };
    return NextResponse.json({ prompt: m.genPrompt || m.prompt || "", model: m.model ?? null });
  } catch (err) {
    return toErrorResponse(err);
  }
}
