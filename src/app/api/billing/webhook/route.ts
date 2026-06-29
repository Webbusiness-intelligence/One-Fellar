// POST /api/billing/webhook — Paystack events (the source of truth for entitlements).
// Verifies the HMAC signature, then grants/resets credits idempotently: billing_events
// .reference is UNIQUE, so Paystack's retries can't double-grant. On a processing error
// the lock row is deleted so the retry reprocesses.
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/paystack";
import { PLANS } from "@/lib/ai-ads/cost";

export const runtime = "nodejs";

type Admin = ReturnType<typeof supabaseAdmin>;

const allotment = (planId: string) => PLANS.find((p) => p.id === planId)?.creditsPerMonth ?? 0;

async function handle(
  admin: Admin,
  evt: { event: string; data?: Record<string, unknown> },
): Promise<{ accountId: string | null; credits: number | null }> {
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const customerCode = typeof customer.customer_code === "string" ? customer.customer_code : undefined;

  async function findAccount(): Promise<string | null> {
    if (meta.accountId) return String(meta.accountId);
    if (customerCode) {
      const { data: a } = await admin
        .from("accounts")
        .select("id")
        .eq("paystack_customer_code", customerCode)
        .maybeSingle();
      return (a?.id as string) ?? null;
    }
    return null;
  }

  if (evt.event === "charge.success") {
    const acct = await findAccount();
    if (!acct) return { accountId: null, credits: null };

    // Credit pack — add to the spendable balance.
    if (meta.kind === "pack") {
      const credits = Number(meta.credits) || 0;
      const { data: a } = await admin.from("accounts").select("credit_balance").eq("id", acct).single();
      await admin
        .from("accounts")
        .update({ credit_balance: (Number(a?.credit_balance) || 0) + credits })
        .eq("id", acct);
      return { accountId: acct, credits };
    }

    // Plan payment (first charge or an auto-renewal) — reset balance to the allotment.
    let planId = meta.planId as string | undefined;
    if (!planId) {
      const { data: a } = await admin.from("accounts").select("plan").eq("id", acct).maybeSingle();
      planId = (a?.plan as string) || "starter";
    }
    const credits = allotment(planId);
    await admin
      .from("accounts")
      .update({
        plan: planId,
        credit_balance: credits,
        plan_period_end: new Date(Date.now() + 31 * 86_400_000).toISOString(),
        ...(customerCode ? { paystack_customer_code: customerCode } : {}),
      })
      .eq("id", acct);
    return { accountId: acct, credits };
  }

  if (evt.event === "subscription.create") {
    const acct = await findAccount();
    const subCode = typeof data.subscription_code === "string" ? data.subscription_code : undefined;
    if (acct) {
      await admin
        .from("accounts")
        .update({
          ...(subCode ? { paystack_subscription_code: subCode } : {}),
          ...(customerCode ? { paystack_customer_code: customerCode } : {}),
        })
        .eq("id", acct);
    }
    return { accountId: acct, credits: null };
  }

  if (evt.event === "subscription.disable" || evt.event === "subscription.not_renew") {
    const acct = await findAccount();
    if (acct) await admin.from("accounts").update({ plan: "free" }).eq("id", acct);
    return { accountId: acct, credits: null };
  }

  return { accountId: null, credits: null };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const evt = JSON.parse(raw) as { event: string; data?: Record<string, unknown> };
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const admin = supabaseAdmin();
  const reference = String(data.reference ?? data.id ?? `${evt.event}:${Date.now()}`);

  // Idempotency lock — first writer wins; a dupe means it's already been handled.
  const lock = await admin.from("billing_events").insert({
    reference,
    event: evt.event,
    amount: typeof data.amount === "number" ? data.amount : null,
    currency: typeof data.currency === "string" ? data.currency : null,
  });
  if (lock.error) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const r = await handle(admin, evt);
    await admin
      .from("billing_events")
      .update({ account_id: r.accountId, credits_granted: r.credits })
      .eq("reference", reference);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await admin.from("billing_events").delete().eq("reference", reference); // release lock → Paystack retries
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
