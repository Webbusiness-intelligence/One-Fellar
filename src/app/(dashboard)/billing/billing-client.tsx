"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Zap,
  Package,
  CreditCard,
  RefreshCw,
  Sparkles,
  Crown,
  Building2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { PLANS, CREDIT_PACKS } from "@/lib/ai-ads/cost";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const zar = (n: number) => `R${n.toLocaleString("en-ZA")}`;
const PLAN_ICON: Record<string, LucideIcon> = { free: Sparkles, starter: Zap, pro: Crown, studio: Building2 };

type Usage = { month: { credits: number; images: number }; all: { credits: number; images: number } };

export function BillingClient() {
  const { account } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-ads/usage")
      .then((r) => r.json())
      .then((j) => setUsage(j))
      .catch(() => {});
  }, []);

  const plan = PLANS.find((p) => p.id === (account?.plan ?? "free")) ?? PLANS[0];
  const Icon = PLAN_ICON[plan.id] ?? Sparkles;
  const paid = plan.usdPerMonth > 0;
  const used = usage?.month.credits ?? 0;
  const total = plan.creditsPerMonth;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  async function checkout(kind: "plan" | "pack", id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const j = await res.json();
      if (j.authorization_url) window.location.href = j.authorization_url;
      else alert(j.error || "Couldn't start checkout. Try again.");
    } catch {
      alert("Couldn't start checkout. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] pb-16">
      <h1 className="mb-8 font-heading text-3xl font-semibold text-foreground">Billing</h1>

      {/* Plan */}
      <div className="glass-panel mb-6 rounded-2xl border border-white/[0.07] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Icon className="size-[18px] text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">{plan.name} plan</p>
              <p className="text-[12px] text-white/30">
                {paid ? `${zar(plan.zarPerMonth)}/month · ` : "Free · "}
                {plan.creditsPerMonth.toLocaleString()} credits / month
              </p>
            </div>
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
              paid
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-white/[0.08] bg-white/[0.03] text-white/40",
            )}
          >
            {paid ? <RefreshCw className="size-2.5" /> : null}
            {paid ? "Active" : "Free"}
          </span>
        </div>
        <div className="mt-5">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[12px] font-medium text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
          >
            {paid ? "Change plan" : "Upgrade plan"} <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {/* Usage */}
      <div className="glass-panel mb-6 rounded-2xl border border-white/[0.07] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Estimated usage · this month</span>
          </div>
          <span className="text-[12px] text-white/30">Resets monthly</span>
        </div>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">{used.toLocaleString()}</span>
          <span className="text-[13px] text-white/30">/ {total.toLocaleString()} credits</span>
        </div>
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-white/20">
          <span>{(usage?.month.images ?? 0).toLocaleString()} generations this month</span>
          <span>All time: {(usage?.all.credits ?? 0).toLocaleString()} credits</span>
        </div>
      </div>

      {/* Top up */}
      <div className="glass-panel mb-6 rounded-2xl border border-white/[0.07] p-6">
        <p className="mb-3 text-[12px] font-medium text-white/50">Need more? Top up credits</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {CREDIT_PACKS.map((pk) => (
            <button
              key={pk.id}
              type="button"
              disabled={busy === pk.id}
              onClick={() => checkout("pack", pk.id)}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center transition-all hover:border-primary/20 hover:bg-white/[0.04] disabled:opacity-60"
            >
              {busy === pk.id ? (
                <Loader2 className="mx-auto mb-1.5 size-4 animate-spin text-white/40" />
              ) : (
                <Package className="mx-auto mb-1.5 size-4 text-white/30 transition-colors group-hover:text-primary" />
              )}
              <p className="text-[16px] font-bold text-foreground">{pk.credits.toLocaleString()}</p>
              <p className="text-[10px] text-white/30">credits</p>
              <p className="mt-1 text-[13px] font-semibold text-primary">{zar(pk.zar)}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/20">One-off purchase, no subscription. Top-up credits expire after 90 days.</p>
      </div>

      {/* Payment method */}
      <div className="glass-panel rounded-2xl border border-white/[0.07] p-6">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Payment method</span>
        </div>
        <p className="text-[13px] leading-relaxed text-white/40">
          Cards and payments are securely handled by <span className="text-white/70">Paystack</span>. You&apos;ll enter
          your details on Paystack&apos;s checkout when you subscribe or top up — nothing sensitive is stored here.
        </p>
      </div>
    </div>
  );
}
