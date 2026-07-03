"use client";

// Public marketing landing — Higgsfield/HeyGen-calibre structure, Kimi design language.
// Every tile is REAL Genalot output served from the app's own storage (no stock).
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Maximize2,
  X,
  Zap,
  Play,
  Image as ImageIcon,
  Clapperboard,
  Megaphone,
  Fingerprint,
  CalendarClock,
} from "lucide-react";

import { AmbientBackground } from "@/components/layout/ambient-background";

const CDN = "https://jjrrwhmvanhmfildtgfw.supabase.co/storage/v1/object/public/ad-studio/";

// ---- Curated real renders ----------------------------------------------------
const FEATURED = {
  src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/3ee14e20-cddb-4ada-ba18-13a6297d7bb5/0.mp4",
  title: "One continuous 15s chase shot — typed, not filmed",
  tag: "Seedance 2.0 · native 4K · directed by Genalot",
};

type Tile = {
  kind: "video" | "image";
  src: string;
  badge: string;
  title: string;
  aspect: string; // tailwind aspect class
  autoplay?: boolean;
};

const GRID: Tile[] = [
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/c6e5a347-760d-41b3-b82a-3a1cc1e6b405/0.mp4",
    badge: "Product ad",
    title: "AURA serum — vertical spot",
    aspect: "aspect-[9/16]",
    autoplay: true,
  },
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/69073f60-c6f0-468d-bd2e-65dacfbcfe0f/0.mp4",
    badge: "UGC",
    title: "Beauty close-up, quick cuts",
    aspect: "aspect-[9/16]",
  },
  {
    kind: "video",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/b5373765-b4f2-4bfa-8869-4eddd047463d/0.mp4",
    badge: "4K film",
    title: "Macro fantasy — woodland fairy",
    aspect: "aspect-video",
  },
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/ed3fe15c-af75-4c0a-86a9-8cc8d6d64e52/0.mp4",
    badge: "Cinematic",
    title: "Coastal drive at golden hour",
    aspect: "aspect-video",
  },
  {
    kind: "image",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/18c9e44f-95e2-485c-a0d1-35cf96df4e5c/0.png",
    badge: "Soul ID",
    title: "@aurora-founder — same face, every scene",
    aspect: "aspect-square",
  },
  {
    kind: "image",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/d750b541-4fe2-4986-9935-8698281e5424/0.png",
    badge: "Poster",
    title: "Typographic quote poster",
    aspect: "aspect-square",
  },
];

const MARQUEE = [
  CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/83afe191-a51d-498e-a98f-2cfdee0ce6fe/0.png",
  CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/57761f7b-d6ed-4909-8cff-09cafe73fb7e/0.png",
  CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/b8ba55e4-ab89-4e00-b22b-c958fb139a15/1.png",
  CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/0475576e-a380-4749-9ce3-f1ad7443bb80/0.png",
  CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/40065300-9753-469a-aec1-373db0b0c95d/0.png",
  CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/18c9e44f-95e2-485c-a0d1-35cf96df4e5c/0.png",
  CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/d750b541-4fe2-4986-9935-8698281e5424/0.png",
];

const CAPABILITIES = [
  {
    icon: Clapperboard,
    name: "4K cinema",
    hot: "NOW IN NATIVE 4K",
    blurb: "Seedance 2.0 direct — continuous 15s shots, real physics, synced sound.",
  },
  {
    icon: ImageIcon,
    name: "Image studio",
    blurb: "8 frontier models behind one composer — photoreal, posters, products.",
  },
  {
    icon: Megaphone,
    name: "Ads & UGC",
    blurb: "Scroll-stopping product spots and creator-style clips from one line.",
  },
  {
    icon: Fingerprint,
    name: "Soul IDs",
    blurb: "Lock a face, product or style once — reuse it consistently everywhere.",
  },
  {
    icon: CalendarClock,
    name: "Autopilot",
    blurb: "Schedule and auto-post to your channels. The loop closes itself.",
  },
];

const STEPS = [
  { n: "01", t: "Type it", d: "One line. Our AI director expands it into a full cinematic brief." },
  { n: "02", t: "Watch it render", d: "Frontier image + video models, native 4K, minutes not weeks." },
  { n: "03", t: "Post it", d: "Schedule or let Autopilot publish to your channels on repeat." },
];

// ---- Components ---------------------------------------------------------------

function HoverVideo({ src, autoplay }: { src: string; autoplay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      autoPlay={autoplay}
      preload="metadata"
      onMouseEnter={() => void ref.current?.play()}
      onMouseLeave={() => {
        if (!autoplay) ref.current?.pause();
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

export function Landing() {
  const [fs, setFs] = useState<{ src: string; kind: "video" | "image" } | null>(null);

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
        {/* Hero — full-bleed 4K render behind the headline */}
        <section className="relative">
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src="/showcase/genalot-4k-1.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/70 via-[#050508]/40 to-[#050508]" />
          </div>

          <div className="relative mx-auto max-w-[1080px] px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
            <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Genalot Studio · now in native 4K</span>
            </div>
            <h1 className="animate-fade-in-up-delay-1 mb-6 font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              What will you <em className="italic text-primary">create</em> today?
            </h1>
            <p className="animate-fade-in-up-delay-2 mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
              Studio-grade film, ads, images and UGC — typed, not filmed. Then scheduled and
              auto-posted. No cameras, no crew, no editors.
            </p>
            <div className="animate-fade-in-up-delay-3 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="ad-cta inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[14px] font-semibold">
                Start creating free <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="#showcase"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/30 px-7 py-3.5 text-[14px] font-medium text-white/80 backdrop-blur transition-all hover:border-white/[0.2] hover:bg-black/50"
              >
                <Play className="size-4" /> Watch real output
              </Link>
            </div>
            <div className="animate-fade-in-up-delay-3 mt-10 flex flex-wrap items-center justify-center gap-2">
              {["Native 4K video", "8 image models", "Soul ID consistency", "Auto-posting"].map((s) => (
                <span key={s} className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-[12px] text-white/50 backdrop-blur">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Marquee — the output wall */}
        <section className="relative py-6">
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/25">
            Real output · zero cameras · all Genalot
          </p>
          <div className="marquee-row overflow-hidden">
            <div className="marquee-track">
              {[...MARQUEE, ...MARQUEE].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-40 w-auto rounded-xl border border-white/[0.06] object-cover sm:h-48"
                />
              ))}
            </div>
          </div>
          <div className="marquee-row mt-4 overflow-hidden">
            <div className="marquee-track reverse">
              {[...MARQUEE.slice().reverse(), ...MARQUEE.slice().reverse()].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-40 w-auto rounded-xl border border-white/[0.06] object-cover sm:h-48"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Showcase */}
        <section id="showcase" className="mx-auto max-w-[1200px] px-6 pt-20 pb-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">Made with Genalot</h2>
              <p className="mt-2 text-[13px] tracking-wide text-white/30">
                Every frame below was rendered from a prompt. Hover to play, click to go fullscreen.
              </p>
            </div>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-white/20 sm:block">
              Prompt → 4K
            </span>
          </div>

          {/* Featured 4K film */}
          <div className="glass-panel group relative overflow-hidden rounded-2xl border border-white/[0.07] transition-all hover:border-primary/20 hover:shadow-[0_0_50px_rgb(245_227_29_/_0.08)]">
            <div className="relative aspect-video w-full bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={FEATURED.src} autoPlay loop muted playsInline preload="auto" className="absolute inset-0 h-full w-full object-contain" />
              <span className="absolute left-3 top-3 rounded-lg bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Native 4K
              </span>
              <button
                type="button"
                onClick={() => setFs({ src: FEATURED.src, kind: "video" })}
                aria-label="View fullscreen"
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-xl bg-black/50 text-white/80 opacity-0 backdrop-blur transition-all hover:text-white group-hover:opacity-100"
              >
                <Maximize2 className="size-4" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-[13px] font-medium text-white/90">{FEATURED.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
                  <Zap className="size-3 text-primary/70" /> {FEATURED.tag}
                </p>
              </div>
            </div>
          </div>

          {/* Mixed grid */}
          <div className="mt-6 grid grid-flow-dense grid-cols-2 gap-4 md:grid-cols-4">
            {GRID.map((t) => (
              <div
                key={t.src}
                className={`glass-panel group relative overflow-hidden rounded-2xl border border-white/[0.07] transition-all hover:border-primary/20 hover:shadow-[0_0_40px_rgb(245_227_29_/_0.07)] ${
                  t.aspect === "aspect-[9/16]" ? "row-span-2" : t.aspect === "aspect-video" ? "col-span-2" : ""
                }`}
              >
                <div className={`relative w-full bg-black ${t.aspect}`}>
                  {t.kind === "video" ? (
                    <HoverVideo src={t.src} autoplay={t.autoplay} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.src} alt={t.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur">
                    {t.badge}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFs({ src: t.src, kind: t.kind })}
                    aria-label="View fullscreen"
                    className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg bg-black/50 text-white/80 opacity-0 backdrop-blur transition-all hover:text-white group-hover:opacity-100"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-[12px] font-medium text-white/85">{t.title}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Your turn card */}
            <div className="glass-panel col-span-2 flex flex-col justify-center rounded-2xl border border-white/[0.07] p-7">
              <h3 className="font-heading text-2xl font-semibold text-white">Your turn.</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/40">
                Type a prompt, pick 4K, and generate work like this — then schedule it straight to
                your channels.
              </p>
              <Link href="/signup" className="ad-cta mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold">
                Start free <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">One studio. Every format.</h2>
            <p className="mt-2 text-[13px] tracking-wide text-white/30">Five ways to make — all from the same composer.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CAPABILITIES.map((c) => (
              <Link
                key={c.name}
                href="/signup"
                className="glass-panel group relative rounded-2xl border border-white/[0.07] p-5 transition-all hover:border-primary/25 hover:shadow-[0_0_40px_rgb(245_227_29_/_0.07)]"
              >
                {c.hot ? (
                  <span className="absolute right-3 top-3 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                    {c.hot}
                  </span>
                ) : null}
                <c.icon className="size-6 text-primary/80" strokeWidth={1.75} />
                <p className="mt-4 text-[15px] font-semibold text-white">{c.name}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/40">{c.blurb}</p>
                <p className="mt-4 flex items-center gap-1 text-[12px] font-medium text-white/30 transition-colors group-hover:text-primary">
                  Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-[1080px] px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/[0.06] p-6">
                <span className="font-mono text-[13px] text-white/20">{s.n}</span>
                <p className="mt-3 font-heading text-xl font-semibold text-white">{s.t}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/40">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1080px] px-6 pb-24 text-center">
          <div className="glass-panel rounded-3xl border border-white/[0.08] px-6 py-14 sm:py-16">
            <h2 className="font-heading text-3xl font-semibold text-white sm:text-5xl">
              Looks like a production house.
              <br />
              <em className="italic text-primary">Costs like a prompt.</em>
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="ad-cta inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[14px] font-semibold">
                Start creating free <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-7 py-3.5 text-[14px] font-medium text-white/70 transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
              >
                <Sparkles className="size-4" /> See pricing
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
          {fs.kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={fs.src}
              controls
              autoPlay
              loop
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] max-w-[95vw] rounded-xl shadow-2xl"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fs.src} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] max-w-[95vw] rounded-xl shadow-2xl" />
          )}
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
