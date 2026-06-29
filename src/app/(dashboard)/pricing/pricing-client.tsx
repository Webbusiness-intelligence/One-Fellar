"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { PLANS, CREDIT_PACKS } from "@/lib/ai-ads/cost";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const zar = (n: number) => `R${n.toLocaleString("en-ZA")}`;

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
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plans &amp; credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio-grade quality — pay only for what you generate. Billed in ZAR via Paystack.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={cn("glass relative flex flex-col rounded-2xl p-5", p.popular && "ring-2 ring-primary/60")}
          >
            {p.popular && (
              <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                Most popular
              </span>
            )}
            <div className="text-sm font-semibold text-foreground">{p.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {p.zarPerMonth === 0 ? "Free" : zar(p.zarPerMonth)}
              </span>
              {p.zarPerMonth > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" />
              {p.creditsPerMonth.toLocaleString()} credits / month
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">{p.blurb}</p>
            <Button
              className="mt-4 w-full"
              variant={p.popular ? "default" : "outline"}
              disabled={p.usdPerMonth === 0 || busy === p.id}
              onClick={() => checkout("plan", p.id)}
            >
              {busy === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : p.usdPerMonth === 0 ? (
                "Free plan"
              ) : (
                "Subscribe"
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Top-up credit packs</h2>
        <p className="mb-4 text-xs text-muted-foreground">One-off purchase, no subscription. Credits expire after 90 days.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pk) => (
            <div key={pk.id} className="glass flex items-center justify-between rounded-2xl p-5">
              <div>
                <div className="text-lg font-semibold text-foreground">{pk.credits.toLocaleString()} credits</div>
                <div className="text-xs text-muted-foreground">{zar(pk.zar)} one-off</div>
              </div>
              <Button variant="outline" disabled={busy === pk.id} onClick={() => checkout("pack", pk.id)}>
                {busy === pk.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
