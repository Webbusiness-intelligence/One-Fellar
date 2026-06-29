// Paystack helpers — South Africa's payment rails (Stripe can't pay out to SA).
// Subscriptions use Paystack "Plans" (create them in the dashboard, wire the plan
// codes via env); credit packs are one-off transactions. The webhook is the source
// of truth for entitlements (see /api/billing/webhook).
import crypto from "node:crypto";

const SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";
const BASE = "https://api.paystack.co";

// Default billing currency. SA Paystack settles in ZAR; override with PAYSTACK_CURRENCY.
export const BILLING_CURRENCY = process.env.PAYSTACK_CURRENCY ?? "ZAR";

// Recurring plan codes are created once in the Paystack dashboard and wired via env.
export function planCode(planId: string): string | undefined {
  return {
    starter: process.env.PAYSTACK_PLAN_STARTER,
    pro: process.env.PAYSTACK_PLAN_PRO,
    studio: process.env.PAYSTACK_PLAN_STUDIO,
  }[planId];
}

interface InitArgs {
  email: string;
  amountSubunits: number; // cents (ignored by Paystack when planCode is set)
  currency?: string;
  planCode?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function initTransaction(
  a: InitArgs,
): Promise<{ authorization_url: string; reference: string }> {
  if (!SECRET) throw new Error("PAYSTACK_SECRET_KEY is not set");
  const body: Record<string, unknown> = {
    email: a.email,
    amount: a.amountSubunits,
    currency: a.currency ?? BILLING_CURRENCY,
    callback_url: a.callbackUrl,
    metadata: a.metadata,
  };
  if (a.planCode) body.plan = a.planCode;

  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message || "Paystack init failed");
  return { authorization_url: json.data.authorization_url, reference: json.data.reference };
}

// Verify the x-paystack-signature header: HMAC-SHA512 of the raw body with the secret.
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!SECRET || !signature) return false;
  const hash = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
