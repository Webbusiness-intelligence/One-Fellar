// /api/ai-ads/usage  (GET)
// Estimated usage for the account: spend + image counts for this month and all
// time, plus a per-model breakdown. Estimated from stored assets × per-model cost.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { assetCredits, MONTHLY_BUDGET_CREDITS } from "@/lib/ai-ads/cost";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const { data, error } = await ctx.supabase
      .from("ad_assets")
      .select("metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let allCredits = 0;
    let allImages = 0;
    let monthCredits = 0;
    let monthImages = 0;
    const byModel: Record<string, { images: number; credits: number }> = {};

    for (const a of data ?? []) {
      const model = (a.metadata as { model?: string } | null)?.model ?? "other";
      const c = assetCredits(model);
      allCredits += c;
      allImages += 1;
      const m = (byModel[model] ??= { images: 0, credits: 0 });
      m.images += 1;
      m.credits += c;
      if (new Date(a.created_at) >= monthStart) {
        monthCredits += c;
        monthImages += 1;
      }
    }

    const breakdown = Object.entries(byModel)
      .map(([model, v]) => ({ model, images: v.images, credits: Math.round(v.credits) }))
      .sort((a, b) => b.credits - a.credits);

    return NextResponse.json({
      budget: MONTHLY_BUDGET_CREDITS,
      month: { credits: Math.round(monthCredits), images: monthImages },
      all: { credits: Math.round(allCredits), images: allImages },
      byModel: breakdown,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
