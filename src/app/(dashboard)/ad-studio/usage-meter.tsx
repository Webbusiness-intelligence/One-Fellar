"use client";

import { useEffect, useState } from "react";
import { Gauge, ChevronDown } from "lucide-react";

type Usage = {
  budget: number;
  month: { credits: number; images: number };
  all: { credits: number; images: number };
  byModel: { model: string; images: number; credits: number }[];
};

const MODEL_LABEL: Record<string, string> = {
  "nano-banana": "Nano Banana",
  "nano-banana-pro": "Nano Banana Pro",
  "nano-banana-edit": "Edits",
  recraft: "Recraft",
  ideogram: "Ideogram",
  "imagen4-ultra": "HD / Best (Imagen)",
  "flux-pro": "FLUX Pro",
  bria: "Bria",
  seedream: "Seedream",
  "gpt-image": "GPT Image",
  poster: "Posters",
  compare: "Compare",
  reframe: "Reframe",
  cutout: "Cutouts",
  locked: "Locked",
  compose: "Text layers",
  other: "Other",
};

export function UsageMeter() {
  const [u, setU] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/ai-ads/usage")
      .then((r) => r.json())
      .then(setU)
      .catch(() => {});
  }, []);

  if (!u) return null;
  const pct = u.budget > 0 ? Math.min(100, (u.month.credits / u.budget) * 100) : 0;
  const over = u.month.credits > u.budget;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <Gauge className="size-3.5 text-primary" />
            Estimated usage · this month
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              {fmt(u.month.credits)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {fmt(u.budget)} credits · {u.month.images} images
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          Breakdown
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">
        All time: {fmt(u.all.credits)} credits · {u.all.images} images
      </div>

      {open ? (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {u.byModel.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nothing generated yet.</p>
          ) : (
            u.byModel.map((m) => (
              <div key={m.model} className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">
                  {MODEL_LABEL[m.model] ?? m.model}{" "}
                  <span className="opacity-60">· {m.images}</span>
                </span>
                <span className="font-medium text-foreground">{fmt(m.credits)} cr</span>
              </div>
            ))
          )}
          <p className="pt-1 text-[11px] text-muted-foreground/70">
            Estimated from generated images — actual provider costs may vary.
          </p>
        </div>
      ) : null}
    </div>
  );
}
