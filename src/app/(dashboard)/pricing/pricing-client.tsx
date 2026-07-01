"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Zap, Crown, Building2, ArrowRight, type LucideIcon } from "lucide-react";

import { PLANS, CREDIT_PACKS } from "@/lib/ai-ads/cost";
import { cn } from "@/lib/utils";

const zar = (n: number) => `R${n.toLocaleString("en-ZA")}`;

const PLAN_ICON: Record<string, LucideIcon> = {
  free: Sparkles,
  starter: Zap,
  pro: Crown,
  studio: Building2,
};

function planFeatures(p: (typeof PLANS)[number]): string[] {
  const paid = p.usdPerMonth > 0;
  return [
    `${p.creditsPerMonth.toLocaleString()} credits / month`,
    paid ? "All models · 1080p · no watermark" : "Draft models · 720p · watermark",
    p.seats > 1 ? `${p.seats} team seats` : "1 seat",
    p.id === "studio" ? "Priority queue + API" : paid ? "Priority generation" : "Community support",
  ];
}

export function PricingClient() {
  const [busy, setBusy] = useState<string | null>(null);

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
    <div className="mx-auto max-w-[1200px] pb-16">
      <div className="mb-12 text-center">
        <h1 className="font-heading text-4xl font-semibold text-foreground sm:text-5xl">
          Plans &amp; <em className="italic text-primary">credits</em>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[14px] text-white/40">
          Studio-grade quality — pay only for what you generate. Billed in ZAR via Paystack.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const Icon = PLAN_ICON[p.id] ?? Sparkles;
          const paid = p.usdPerMonth > 0;
          return (
            <div
              key={p.id}
              className={cn(
                "glass-panel relative flex flex-col rounded-2xl border p-6 transition-all hover:shadow-[0_0_40px_rgb(245_227_29_/_0.08)]",
                p.popular ? "border-primary/20" : "border-white/[0.06]",
              )}
            >
              {p.popular && (
                <span className="mb-4 w-fit rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </span>
              )}
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border",
                    p.popular ? "border-primary/20 bg-primary/10" : "border-white/[0.06] bg-white/[0.03]",
                  )}
                >
                  <Icon className={cn("size-[18px]", p.popular ? "text-primary" : "text-white/50")} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{p.name}</h3>
              </div>
              <p className="mb-4 text-[13px] text-white/40">{p.blurb}</p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {p.zarPerMonth === 0 ? "Free" : zar(p.zarPerMonth)}
                </span>
                {p.zarPerMonth > 0 && <span className="text-[13px] text-white/30">/mo</span>}
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {planFeatures(p).map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                    <span className="text-[13px] text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={!paid || busy === p.id}
                onClick={() => checkout("plan", p.id)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition-all disabled:opacity-60",
                  p.popular
                    ? "ad-cta"
                    : "border border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/[0.12] hover:bg-white/[0.06]",
                )}
              >
                {busy === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !paid ? (
                  "Free plan"
                ) : (
                  <>
                    Subscribe <ArrowRight className="size-3.5" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <h2 className="mb-1 font-heading text-2xl font-semibold text-foreground">Top-up credit packs</h2>
        <p className="mb-5 text-[13px] text-white/40">One-off purchase, no subscription. Credits expire after 90 days.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pk) => (
            <div
              key={pk.id}
              className="glass-panel flex items-center justify-between rounded-2xl border border-white/[0.07] p-6"
            >
              <div>
                <div className="text-lg font-semibold text-foreground">{pk.credits.toLocaleString()} credits</div>
                <div className="text-[13px] text-white/40">{zar(pk.zar)} one-off</div>
              </div>
              <button
                type="button"
                disabled={busy === pk.id}
                onClick={() => checkout("pack", pk.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.06] disabled:opacity-60"
              >
                {busy === pk.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
