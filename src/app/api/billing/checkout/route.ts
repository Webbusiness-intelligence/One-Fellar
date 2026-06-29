// POST /api/billing/checkout — start a Paystack payment.
// Body: { kind: "plan" | "pack", id: string }. Returns { authorization_url } to redirect
// the user to Paystack. Credits are granted by the webhook on charge.success, never here.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { PLANS, CREDIT_PACKS } from "@/lib/ai-ads/cost";
import { initTransaction, planCode, BILLING_CURRENCY } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const { data: userRes } = await ctx.supabase.auth.getUser();
    const email = userRes.user?.email;
    if (!email) return NextResponse.json({ error: "No email on this account" }, { status: 400 });

    const { kind, id } = (await req.json()) as { kind?: string; id?: string };
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const callbackUrl = `${origin}/pricing?status=success`;

    if (kind === "plan") {
      const plan = PLANS.find((p) => p.id === id && p.usdPerMonth > 0);
      if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
      const code = planCode(plan.id);
      if (!code) {
        return NextResponse.json(
          { error: `Paystack plan code missing for "${plan.id}" — set PAYSTACK_PLAN_${plan.id.toUpperCase()}` },
          { status: 500 },
        );
      }
      const { authorization_url } = await initTransaction({
        email,
        amountSubunits: Math.round(plan.zarPerMonth * 100), // ZAR cents (Paystack uses the plan's amount)
        planCode: code,
        callbackUrl,
        metadata: { accountId: ctx.accountId, kind: "plan", planId: plan.id },
      });
      return NextResponse.json({ authorization_url });
    }

    if (kind === "pack") {
      const pack = CREDIT_PACKS.find((p) => p.id === id);
      if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
      const { authorization_url } = await initTransaction({
        email,
        amountSubunits: Math.round(pack.zar * 100),
        currency: BILLING_CURRENCY,
        callbackUrl,
        metadata: { accountId: ctx.accountId, kind: "pack", packId: pack.id, credits: pack.credits },
      });
      return NextResponse.json({ authorization_url });
    }

    return NextResponse.json({ error: "kind must be 'plan' or 'pack'" }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
