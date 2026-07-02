"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Maximize2, X, Zap } from "lucide-react";

import { AmbientBackground } from "@/components/layout/ambient-background";

const SHOWCASE = [
  {
    src: "/showcase/genalot-4k-1.mp4",
    title: "Cinematic character — native 4K",
    tag: "Video · 4K · Seedance 2.0 · directed by Genalot",
  },
  {
    src: "/showcase/genalot-4k-2.mp4",
    title: "Macro fantasy creature — native 4K",
    tag: "Video · 4K · Seedance 2.0 · directed by Genalot",
  },
];

const CAPABILITIES = ["Images", "Video", "Ads & posters", "UGC", "Soul IDs", "Auto-posting"];

export function Landing() {
  const [fs, setFs] = useState<string | null>(null);

  return (
    <div className="genalot-canvas relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      <AmbientBackground />

      {/* Nav */}
      <nav className="relative z-40 mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/genalot-icon.png" alt="Genalot" className="h-8 w-8 rounded-lg transition-transform group-hover:scale-105" />
          <span className="text-[15px] font-semibold tracking-tight text-white/90">Genalot</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="hidden rounded-lg px-4 py-2 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 sm:block">
            Pricing
          </Link>
          <Link href="/login" className="hidden rounded-lg px-4 py-2 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 sm:block">
            Log in
          </Link>
          <Link href="/signup" className="ad-cta rounded-xl px-4 py-2 text-[13px] font-semibold">
            Get started
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-[1080px] px-6 pt-24 pb-14 text-center">
          <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Genalot Studio</span>
          </div>
          <h1 className="animate-fade-in-up-delay-1 mb-6 font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            What will you <em className="italic text-primary">create</em> today?
          </h1>
          <p className="animate-fade-in-up-delay-2 mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/40 sm:text-lg">
            From a single line of text to finished ads, images and film — then schedule and auto-post them.
            Studio-grade output that looks like you spent a fortune.
          </p>
          <div className="animate-fade-in-up-delay-3 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="ad-cta inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold">
              Start creating <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
            <Link
              href="/ad-studio"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-[14px] font-medium text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
            >
              <Sparkles className="size-4" /> Explore the studio
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {CAPABILITIES.map((c) => (
              <span key={c} className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[12px] text-white/40">
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* Showcase — the real 4K clips */}
        <section className="mx-auto max-w-[1200px] px-6 pb-24">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">Real 4K, made with Genalot</h2>
              <p className="mt-2 text-[13px] tracking-wide text-white/30">
                Actual output — rendered from a prompt, in native 4K. Click to view fullscreen.
              </p>
            </div>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-white/20 sm:block">
              Prompt → 4K
            </span>
          </div>

          {/* Featured (large) */}
          <ShowcaseTile item={SHOWCASE[0]} featured onFullscreen={() => setFs(SHOWCASE[0].src)} />

          {/* Second */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ShowcaseTile item={SHOWCASE[1]} onFullscreen={() => setFs(SHOWCASE[1].src)} />
            <div className="glass-panel flex flex-col justify-center rounded-2xl border border-white/[0.07] p-8">
              <h3 className="font-heading text-2xl font-semibold text-white">Your turn.</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/40">
                Type a prompt, pick 4K, and generate cinematic video like this — then schedule it straight to your channels.
              </p>
              <Link href="/signup" className="ad-cta mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold">
                Start free <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/genalot-icon.png" alt="Genalot" className="h-6 w-6 rounded-md" />
            <span className="text-[13px] text-white/30">Genalot — AI creation suite</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-[12px] text-white/25 transition-colors hover:text-white/50">Pricing</Link>
            <Link href="/login" className="text-[12px] text-white/25 transition-colors hover:text-white/50">Log in</Link>
            <Link href="/signup" className="text-[12px] text-white/25 transition-colors hover:text-white/50">Sign up</Link>
          </div>
        </div>
      </footer>

      {/* Fullscreen lightbox */}
      {fs ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setFs(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={fs}
            controls
            autoPlay
            loop
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[95vw] rounded-xl shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setFs(null)}
            aria-label="Close"
            className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ShowcaseTile({
  item,
  featured,
  onFullscreen,
}: {
  item: (typeof SHOWCASE)[number];
  featured?: boolean;
  onFullscreen: () => void;
}) {
  return (
    <div
      className={`glass-panel group relative overflow-hidden rounded-2xl border border-white/[0.07] transition-all hover:border-primary/20 hover:shadow-[0_0_50px_rgb(245_227_29_/_0.08)] ${
        featured ? "" : ""
      }`}
    >
      <div className={`relative w-full bg-black ${featured ? "aspect-video" : "aspect-video"}`}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={item.src}
          autoPlay
          loop
          muted
          playsInline
          preload={featured ? "auto" : "metadata"}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {/* 4K badge */}
        <span className="absolute left-3 top-3 rounded-lg bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          4K
        </span>
        {/* Fullscreen button */}
        <button
          type="button"
          onClick={onFullscreen}
          aria-label="View fullscreen"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-xl bg-black/50 text-white/80 opacity-0 backdrop-blur transition-all hover:text-white group-hover:opacity-100"
        >
          <Maximize2 className="size-4" />
        </button>
        {/* Caption */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-[13px] font-medium text-white/90">{item.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
            <Zap className="size-3 text-primary/70" /> {item.tag}
          </p>
        </div>
      </div>
    </div>
  );
}
