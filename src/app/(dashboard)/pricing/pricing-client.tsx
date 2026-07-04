"use client";

import { useState } from "react";
import {
  Check,
  Loader2,
  Zap,
  Crown,
  Building2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Lock,
  Sparkles,
  Film,
  Image as ImageIcon,
  Fingerprint,
  Send,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";

import { PLANS, CREDIT_PACKS } from "@/lib/ai-ads/cost";
import { cn } from "@/lib/utils";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const PLAN_ICON: Record<string, LucideIcon> = { starter: Zap, pro: Crown, studio: Building2 };

// Cumulative feature framing ("Everything in X, plus…") — the strongest tier-ladder pattern.
const PLAN_FEATURES: Record<string, { lead?: string; items: string[] }> = {
  starter: {
    items: [
      "All 8 AI image models",
      "Native 4K video with sound",
      "No watermark · commercial use",
      "Soul IDs for brand consistency",
      "Schedule + auto-post to socials",
      "1 seat · standard queue",
    ],
  },
  pro: {
    lead: "Everything in Starter, plus",
    items: ["Priority generation queue", "Higher batch + variation limits", "Early access to new models", "Best value per credit"],
  },
  studio: {
    lead: "Everything in Pro, plus",
    items: ["5 team seats", "API access", "Fastest priority queue", "Priority support"],
  },
};

// Roughly what a month of credits makes, in the most relatable unit (a standard image ≈ 5 credits).
const approxImages = (credits: number) => Math.round(credits / 5 / 50) * 50;

const INCLUDED = [
  { icon: Film, label: "Native 4K video" },
  { icon: ImageIcon, label: "8 image models" },
  { icon: Fingerprint, label: "Soul IDs" },
  { icon: Send, label: "Auto-posting" },
  { icon: BadgeCheck, label: "No watermark" },
  { icon: Sparkles, label: "Commercial use" },
];

const FAQ = [
  {
    q: "What is a credit?",
    a: "Credits are what you spend when you generate. A standard image is about 5 credits; video costs more depending on length and resolution. Your plan refills your credits every billing period.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your billing settings in a couple of clicks — no lock-in. You keep full access and any remaining credits until the end of your current paid period.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Plan credits refresh at the start of each billing period. Top-up pack credits are separate and stay valid for 90 days from purchase.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "You can buy a one-off top-up pack at any time, or upgrade your plan. We never auto-charge you for overage — you're always in control.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes — within 7 days of your first purchase, as long as you haven't used any credits. Full details are in our Refund Policy.",
  },
  {
    q: "Do I own what I create?",
    a: "Yes. You own the images and videos you generate and can use them commercially, subject to our Terms of Service.",
  },
];

export function PricingClient() {
  const [busy, setBusy] = useState<string | null>(null);
  const plans = PLANS.filter((p) => p.usdPerMonth > 0); // no free trial — paid tiers only

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
    <div className="mx-auto max-w-[1200px] pb-20">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Pricing</span>
        </div>
        <h1 className="font-heading text-4xl font-semibold text-foreground sm:text-5xl">
          Simple pricing that <em className="italic text-primary">scales</em> with you
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/40">
          Native 4K video, 8 image models, Soul IDs and auto-posting — in one studio. Pick a plan and
          start shipping content today.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-white/35">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary/60" /> Billed in USD</span>
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-3.5 text-primary/60" /> Cancel anytime</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5 text-primary/60" /> Secure checkout</span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((p) => {
          const Icon = PLAN_ICON[p.id] ?? Zap;
          const feat = PLAN_FEATURES[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                "glass-panel relative flex flex-col rounded-2xl p-7 transition-all",
                p.popular
                  ? "border-2 border-primary/40 shadow-[0_0_60px_rgb(245_227_29_/_0.1)] lg:-translate-y-2"
                  : "border border-white/[0.07] hover:border-white/[0.12]",
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </span>
              )}
              <div className="mb-4 flex items-center gap-3">
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

              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-bold tracking-tight text-foreground">{usd(p.usdPerMonth)}</span>
                <span className="text-[13px] text-white/30">/mo</span>
              </div>
              <p className="mb-5 text-[13px] text-white/40">{p.blurb}</p>

              {/* Value anchor */}
              <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[15px] font-semibold text-white/90">{p.creditsPerMonth.toLocaleString()} credits / month</p>
                <p className="mt-0.5 text-[12px] text-white/40">
                  ≈ {approxImages(p.creditsPerMonth).toLocaleString()} images — or mix in HD &amp; 4K video
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {feat.lead && (
                  <li className="text-[12px] font-medium uppercase tracking-wide text-white/30">{feat.lead}</li>
                )}
                {feat.items.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                    <span className="text-[13px] text-white/65">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => checkout("plan", p.id)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-semibold transition-all disabled:opacity-60",
                  p.popular
                    ? "ad-cta"
                    : "border border-white/[0.1] bg-white/[0.04] text-white/80 hover:border-white/[0.16] hover:bg-white/[0.07]",
                )}
              >
                {busy === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Get {p.name} <ArrowRight className="size-3.5" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Included in every plan */}
      <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Every plan includes
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {INCLUDED.map((i) => (
            <span key={i.label} className="inline-flex items-center gap-2 text-[13px] text-white/55">
              <i.icon className="size-4 text-primary/70" strokeWidth={1.75} /> {i.label}
            </span>
          ))}
        </div>
      </div>

      {/* Credit packs */}
      <div className="mt-14">
        <div className="mb-5 text-center">
          <h2 className="font-heading text-2xl font-semibold text-foreground">Need more? Top up anytime</h2>
          <p className="mt-2 text-[13px] text-white/40">One-off credit packs — no subscription. Pack credits stay valid for 90 days.</p>
        </div>
        <div className="mx-auto grid max-w-[720px] gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pk) => (
            <div key={pk.id} className="glass-panel flex items-center justify-between rounded-2xl border border-white/[0.07] p-6">
              <div>
                <div className="text-lg font-semibold text-foreground">{pk.credits.toLocaleString()} credits</div>
                <div className="text-[13px] text-white/40">
                  {usd(pk.usd)} · ≈ {approxImages(pk.credits).toLocaleString()} images
                </div>
              </div>
              <button
                type="button"
                disabled={busy === pk.id}
                onClick={() => checkout("pack", pk.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-[13px] font-semibold text-white/80 transition-all hover:border-white/[0.16] hover:bg-white/[0.07] disabled:opacity-60"
              >
                {busy === pk.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Guarantee */}
      <div className="mt-12 flex items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
          <ShieldCheck className="size-5 shrink-0 text-primary/70" />
          <p className="text-[13px] text-white/50">
            <span className="font-semibold text-white/80">7-day money-back</span> on your first purchase if you
            haven&apos;t used any credits. See our{" "}
            <a href="/refund" className="text-primary/70 hover:text-primary">Refund Policy</a>.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-16 max-w-[760px]">
        <h2 className="mb-6 text-center font-heading text-2xl font-semibold text-foreground">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-medium text-white/80">
                {f.q}
                <ArrowRight className="size-4 shrink-0 text-white/30 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-[13px] leading-relaxed text-white/45">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
