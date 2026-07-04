"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Image as ImageIcon, Film, Send, type LucideIcon } from "lucide-react";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: ImageIcon, label: "AI images & ads" },
  { icon: Film, label: "Cinematic 4K video" },
  { icon: Send, label: "Auto-scheduling" },
];

// Dark split-screen auth frame (Genalot UI): a cinematic brand panel on the left
// (dimmed 4K render behind the copy) and a glass card on the right for the form, over
// an ambient particle field. `mode` renders the Log in / Sign up segmented toggle;
// omit it for standalone states (e.g. the "check your email" card).
export function AuthShell({ mode, children }: { mode?: "login" | "signup"; children: ReactNode }) {
  return (
    <div className="genalot-canvas relative flex min-h-screen w-full overflow-hidden bg-[#050508] text-white">
      <AmbientBackground />

      {/* Left: brand panel with a dimmed, looping 4K render behind it */}
      <div className="relative z-10 hidden w-[44%] flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src="/showcase/genalot-4k-1.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#050508]/70 via-[#050508]/45 to-[#050508]/85" />
          {/* blend the panel into the form side */}
          <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-[#050508] to-transparent" />
        </div>

        <Link href="/" className="group flex items-center gap-2.5 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/genalot-icon.png" alt="Genalot" className="h-9 w-9 rounded-xl transition-transform group-hover:scale-105" />
          <span className="text-[17px] font-semibold text-white/90">Genalot</span>
        </Link>

        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">AI creation suite</span>
          </div>
          <h2 className="mb-4 font-heading text-4xl font-semibold leading-tight text-white lg:text-5xl">
            Create with the power of <em className="italic text-primary">AI</em>
          </h2>
          <p className="max-w-sm text-[14px] leading-relaxed text-white/50">
            Generate studio-grade images, videos and ads — then schedule and post them — all from
            one prompt. Everything on this screen was made with Genalot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 backdrop-blur">
              <f.icon className="size-4 text-primary" strokeWidth={1.5} />
              <p className="text-[12px] text-white/70">{f.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/genalot-icon.png" alt="Genalot" className="h-8 w-8 rounded-lg" />
            <span className="text-[17px] font-semibold text-white/90">Genalot</span>
          </div>
          <div className="glass-strong rounded-3xl border border-white/[0.08] p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
            {mode ? (
              <div className="mb-8 flex items-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-0.5">
                <Link
                  href="/login"
                  className={cn(
                    "flex-1 rounded-lg py-2.5 text-center text-[13px] font-medium transition-all",
                    mode === "login" ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white/60",
                  )}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    "flex-1 rounded-lg py-2.5 text-center text-[13px] font-medium transition-all",
                    mode === "signup" ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white/60",
                  )}
                >
                  Sign up
                </Link>
              </div>
            ) : null}
            {children}
          </div>
          <p className="mt-6 text-center text-[11px] text-white/25">
            Protected by industry-standard encryption
          </p>
        </div>
      </div>
    </div>
  );
}

// A glass input row with an optional leading icon + right slot (e.g. a show-password
// toggle) and the yellow focus-within glow.
export function AuthField({
  icon: Icon,
  rightSlot,
  className,
  ...props
}: { icon?: LucideIcon; rightSlot?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all focus-within:border-primary/30 focus-within:shadow-[0_0_20px_rgb(245_227_29_/_0.06)]">
      {Icon ? <Icon className="pointer-events-none absolute left-3.5 size-4 text-white/20" /> : null}
      <input
        {...props}
        className={cn(
          "w-full bg-transparent py-3 text-[14px] text-white placeholder:text-white/20 outline-none",
          Icon ? "pl-10" : "pl-4",
          rightSlot ? "pr-10" : "pr-4",
          className,
        )}
      />
      {rightSlot}
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{children}</div>
  );
}
