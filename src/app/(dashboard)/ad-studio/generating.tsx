"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// Premium, ChatGPT-style "designing your image" state: glowing animated tiles,
// step labels that advance, a live elapsed timer and an eased progress bar.
const STEPS = [
  "Reading your prompt",
  "Sketching the composition",
  "Designing light & mood",
  "Rendering fine details",
  "Adding the final polish",
];

export function GeneratingPanel({
  count,
  prompt,
  etaSeconds = 24,
  steps = STEPS,
}: {
  count: number;
  prompt?: string;
  etaSeconds?: number;
  steps?: string[];
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, []);

  // Step cadence + eased progress scale to the expected time (images ~24s,
  // video ~90s). The real result replacing this panel is the true 100%.
  const stepIndex = Math.min(steps.length - 1, Math.floor(elapsed / (etaSeconds / steps.length)));
  const step = steps[stepIndex];
  const progress = Math.min(96, Math.round(100 * (1 - Math.exp(-elapsed / (etaSeconds * 0.45)))));

  return (
    <div className="space-y-2.5">
      {prompt ? (
        <p className="line-clamp-1 px-0.5 text-[13px] text-muted-foreground">{prompt}</p>
      ) : null}

      <div className="flex items-center gap-2.5">
        <Sparkles className="size-4 shrink-0 animate-pulse text-primary" />
        <span className="ad-grad-text text-[13px] font-medium">{step}…</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">{elapsed.toFixed(0)}s</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-40">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
            {progress}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="ad-gen-tile relative aspect-square overflow-hidden rounded-xl"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <div className="ad-gen-rotor absolute inset-0" />
            <div className="ad-gen-sweep absolute inset-0" style={{ animationDelay: `${i * 0.18}s` }} />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
              <Sparkles className="size-6 animate-pulse text-white/85" />
              <span className="text-[11px] font-medium text-white/70">{step}…</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
