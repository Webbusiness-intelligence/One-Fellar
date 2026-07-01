"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Image as ImageIcon, Film, Send, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: ImageIcon, label: "AI images & ads" },
  { icon: Film, label: "Cinematic video" },
  { icon: Send, label: "Auto-scheduling" },
];

// Dark split-screen auth frame (Genalot UI): a brand panel on the left (desktop)
// and a glass card on the right for the form. `mode` renders the Log in / Sign up
// segmented toggle; omit it for standalone states (e.g. the "check your email" card).
export function AuthShell({ mode, children }: { mode?: "login" | "signup"; children: ReactNode }) {
  return (
    <div className="genalot-canvas relative flex min-h-screen w-full overflow-hidden bg-[#050508] text-white">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="pulse-glow absolute left-1/4 top-1/3 h-[600px] w-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(245,227,29,0.02) 0%, transparent 70%)" }}
        />
        <div
          className="pulse-glow absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(100,200,255,0.015) 0%, transparent 70%)", animationDelay: "2s" }}
        />
      </div>

      {/* Left: brand */}
      <div className="relative z-10 hidden flex-1 flex-col justify-between p-12 lg:flex">
        <Link href="/" className="group flex items-center gap-2.5 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/genalot-icon.png" alt="Genalot" className="h-9 w-9 rounded-xl transition-transform group-hover:scale-105" />
          <span className="text-[17px] font-semibold text-white/90">Genalot</span>
        </Link>
        <div>
          <h2 className="mb-4 font-heading text-4xl font-semibold leading-tight text-white">
            Create with the power of <em className="italic text-primary">AI</em>
          </h2>
          <p className="max-w-sm text-[14px] leading-relaxed text-white/40">
            Generate stunning images, videos and ads — then schedule and post them — from one AI-powered studio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="glass-panel flex items-center gap-2 rounded-xl border border-white/[0.06] px-3.5 py-3">
              <f.icon className="size-4 text-primary" strokeWidth={1.5} />
              <p className="text-[12px] text-white/60">{f.label}</p>
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
          <div className="glass-panel rounded-2xl border border-white/[0.07] p-8">
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
