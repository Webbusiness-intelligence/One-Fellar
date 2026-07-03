"use client";

// Public marketing landing v3 — researched against Higgsfield, HeyGen, Runway and Luma.
// Moves used: video-first hero (Higgsfield), typewriter prompt bar (product-true demo),
// named frontier models as authority (Runway/Luma), concrete use-case briefs (Luma),
// prompt→output proof, stat pills (HeyGen), scroll reveals, sticky glass nav.
// Every tile is REAL Genalot output served from the app's own storage — no stock.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
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
  Terminal,
} from "lucide-react";

import { AmbientBackground } from "@/components/layout/ambient-background";

const CDN = "https://jjrrwhmvanhmfildtgfw.supabase.co/storage/v1/object/public/ad-studio/";

// ---- Curated real renders ----------------------------------------------------
const FEATURED = {
  src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/3ee14e20-cddb-4ada-ba18-13a6297d7bb5/0.mp4",
  prompt:
    "A young fairy boy runs, leaps and climbs through a colossal jungle of mile-high trees — one continuous chase shot filmed from behind, 15 seconds, native 4K.",
  title: "One continuous 15s chase shot — typed, not filmed",
  tag: "Seedance 2.0 · native 4K · directed by Genalot",
};

type Tile = {
  kind: "video" | "image";
  src: string;
  badge: string;
  title: string;
  meta?: string;
  aspect: string;
  autoplay?: boolean;
};

const GRID: Tile[] = [
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/c6e5a347-760d-41b3-b82a-3a1cc1e6b405/0.mp4",
    badge: "Product ad",
    title: "AURA serum — vertical spot",
    meta: "12s · 9:16",
    aspect: "aspect-[9/16]",
    autoplay: true,
  },
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/69073f60-c6f0-468d-bd2e-65dacfbcfe0f/0.mp4",
    badge: "UGC",
    title: "Beauty close-up, quick cuts",
    meta: "5s · 9:16",
    aspect: "aspect-[9/16]",
  },
  {
    kind: "video",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/b5373765-b4f2-4bfa-8869-4eddd047463d/0.mp4",
    badge: "4K film",
    title: "Macro fantasy — woodland fairy",
    meta: "5s · 4K",
    aspect: "aspect-video",
  },
  {
    kind: "video",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/ed3fe15c-af75-4c0a-86a9-8cc8d6d64e52/0.mp4",
    badge: "Cinematic",
    title: "Coastal drive at golden hour",
    meta: "5s · 16:9",
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

const MODELS = ["Seedance 2.0", "Kling 3", "GPT Image 2", "Imagen 4 Ultra", "Flux Pro", "Gemini"];

const TYPED_PROMPTS = [
  "a 15s 4K chase shot through a colossal jungle, one continuous take…",
  "vertical launch ad for AURA serum — luxury glass, golden hour…",
  "UGC clip: creator unboxing on camera, handheld, TikTok energy…",
  "@aurora-founder presenting on stage, same face as always…",
];

const BRIEFS = [
  "Launch a vertical product ad",
  "UGC for TikTok & Reels",
  "A 4K brand film",
  "A product photoshoot",
  "A consistent brand character",
  "A 30-day calendar on Autopilot",
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
  { n: "01", t: "Type it", d: "One line. Our AI director expands it into a full cinematic brief — framing, physics, light, sound." },
  { n: "02", t: "Watch it render", d: "Frontier image and video models, native 4K, minutes not weeks. Every take lands in your gallery." },
  { n: "03", t: "Post it", d: "Schedule it on the planner — or let Autopilot generate and publish to your channels on repeat." },
];

// ---- Primitives ---------------------------------------------------------------

// Adds .in when the element scrolls into view (CSS .reveal handles the motion).
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => el.classList.add("in"), delay);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

// Loops through real prompts character by character — the product, demoed in one line.
function TypedPrompt() {
  const [text, setText] = useState("");
  useEffect(() => {
    let p = 0;
    let i = 0;
    let deleting = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = TYPED_PROMPTS[p];
      if (!deleting) {
        i++;
        setText(full.slice(0, i));
        if (i >= full.length) {
          deleting = true;
          t = setTimeout(tick, 2200);
          return;
        }
        t = setTimeout(tick, 34);
      } else {
        i -= 3;
        setText(full.slice(0, Math.max(0, i)));
        if (i <= 0) {
          deleting = false;
          p = (p + 1) % TYPED_PROMPTS.length;
          t = setTimeout(tick, 350);
          return;
        }
        t = setTimeout(tick, 14);
      }
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <span className="text-white/70">
      {text}
      <span className="type-caret text-primary">▍</span>
    </span>
  );
}

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

// ---- Page ----------------------------------------------------------------------

export function Landing() {
  const [fs, setFs] = useState<{ src: string; kind: "video" | "image" } | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="genalot-canvas relative min-h-screen overflow-x-hidden bg-[#050508] text-white">
      <AmbientBackground />

      {/* Sticky nav — transparent over the hero, glass once scrolling */}
      <nav
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          scrolled ? "border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/genalot-icon.png" alt="Genalot" className="h-8 w-8 rounded-lg transition-transform group-hover:scale-105" />
            <span className="text-[15px] font-semibold tracking-tight text-white/90">Genalot</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="#showcase" className="hidden rounded-lg px-4 py-2 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 sm:block">
              Showcase
            </Link>
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
            <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/75 via-[#050508]/35 to-[#050508]" />
          </div>

          <div className="relative mx-auto max-w-[1080px] px-6 pt-36 pb-16 text-center sm:pt-44 sm:pb-20">
            <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Genalot Studio · now in native 4K</span>
            </div>
            <h1 className="animate-fade-in-up-delay-1 mb-6 font-heading text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-7xl lg:text-8xl">
              What will you <em className="italic text-primary">create</em> today?
            </h1>
            <p className="animate-fade-in-up-delay-2 mx-auto mb-9 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
              Studio-grade film, ads, images and UGC — typed, not filmed. Then scheduled and
              auto-posted. No cameras, no crew, no editors.
            </p>

            {/* Live prompt bar — the product, demoed */}
            <div className="animate-fade-in-up-delay-2 mx-auto mb-9 flex max-w-2xl items-center gap-3 rounded-2xl border border-white/[0.1] bg-black/50 px-4 py-3.5 text-left backdrop-blur-xl">
              <Terminal className="size-4 shrink-0 text-primary/70" />
              <p className="min-h-[1.4em] flex-1 truncate font-mono text-[13px]">
                <TypedPrompt />
              </p>
              <Link href="/signup" className="ad-cta hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold sm:inline-flex">
                Generate <Sparkles className="size-3.5" />
              </Link>
            </div>

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

            {/* Named models — authority through specificity */}
            <div className="animate-fade-in-up-delay-3 mt-12">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Orchestrating frontier models</p>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {MODELS.map((m) => (
                  <span key={m} className="text-[13px] font-medium tracking-wide text-white/35">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <a href="#showcase" aria-label="Scroll to showcase" className="mt-12 inline-flex animate-bounce items-center justify-center text-white/25 transition-colors hover:text-white/50">
              <ArrowDown className="size-5" />
            </a>
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
                <img key={i} src={src} alt="" loading="lazy" className="h-40 w-auto rounded-xl border border-white/[0.06] object-cover sm:h-48" />
              ))}
            </div>
          </div>
          <div className="marquee-row mt-4 overflow-hidden">
            <div className="marquee-track reverse slow">
              {[...MARQUEE.slice().reverse(), ...MARQUEE.slice().reverse()].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" loading="lazy" className="h-40 w-auto rounded-xl border border-white/[0.06] object-cover sm:h-48" />
              ))}
            </div>
          </div>
        </section>

        {/* Showcase */}
        <section id="showcase" className="mx-auto max-w-[1200px] scroll-mt-20 px-6 pt-20 pb-8">
          <Reveal>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">Made with Genalot</h2>
                <p className="mt-2 text-[13px] tracking-wide text-white/30">
                  Every frame below was rendered from a prompt. Hover to play, click to go fullscreen.
                </p>
              </div>
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-white/20 sm:block">Prompt → 4K</span>
            </div>
          </Reveal>

          {/* The prompt that made the film — proof nobody fakes */}
          <Reveal>
            <div className="mb-3 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="mt-0.5 shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Prompt
              </span>
              <p className="font-mono text-[12.5px] leading-relaxed text-white/45">{FEATURED.prompt}</p>
            </div>
          </Reveal>

          {/* Featured 4K film */}
          <Reveal>
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
          </Reveal>

          {/* Mixed grid */}
          <div className="mt-6 grid grid-flow-dense grid-cols-2 gap-4 md:grid-cols-4">
            {GRID.map((t, gi) => (
              <Reveal
                key={t.src}
                delay={gi * 60}
                className={t.aspect === "aspect-[9/16]" ? "row-span-2" : t.aspect === "aspect-video" ? "col-span-2" : ""}
              >
                <div className="glass-panel group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] transition-all hover:border-primary/20 hover:shadow-[0_0_40px_rgb(245_227_29_/_0.07)]">
                  <div className={`relative w-full bg-black ${t.aspect}`}>
                    {t.kind === "video" ? (
                      <>
                        <HoverVideo src={t.src} autoplay={t.autoplay} />
                        {!t.autoplay ? (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90 transition-opacity duration-300 group-hover:opacity-0">
                            <span className="flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur">
                              <Play className="size-4 text-white/90" />
                            </span>
                          </span>
                        ) : null}
                      </>
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-[12px] font-medium text-white/85">{t.title}</p>
                      {t.meta ? <span className="shrink-0 font-mono text-[10px] text-white/40">{t.meta}</span> : null}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}

            {/* Your turn card */}
            <Reveal className="col-span-2" delay={360}>
              <div className="glass-panel flex h-full flex-col justify-center rounded-2xl border border-white/[0.07] p-7">
                <h3 className="font-heading text-2xl font-semibold text-white">Your turn.</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/40">
                  Type a prompt, pick 4K, and generate work like this — then schedule it straight to your channels.
                </p>
                <Link href="/signup" className="ad-cta mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold">
                  Start free <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Concrete briefs — what's due this week? */}
        <section className="mx-auto max-w-[1080px] px-6 py-16 text-center">
          <Reveal>
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/25">What&apos;s due this week?</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {BRIEFS.map((b) => (
                <Link
                  key={b}
                  href="/signup"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white/60 transition-all hover:border-primary/30 hover:text-white"
                >
                  {b}
                </Link>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Capabilities */}
        <section className="mx-auto max-w-[1200px] px-6 pb-20">
          <Reveal>
            <div className="mb-10 text-center">
              <h2 className="font-heading text-3xl font-semibold text-white sm:text-4xl">One studio. Every format.</h2>
              <p className="mt-2 text-[13px] tracking-wide text-white/30">Five ways to make — all from the same composer.</p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CAPABILITIES.map((c, ci) => (
              <Reveal key={c.name} delay={ci * 70}>
                <Link
                  href="/signup"
                  className="glass-panel group relative block h-full rounded-2xl border border-white/[0.07] p-5 transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_0_40px_rgb(245_227_29_/_0.07)]"
                >
                  {c.hot ? (
                    <span className="absolute right-3 top-3 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      {c.hot}
                    </span>
                  ) : null}
                  <span className="font-mono text-[11px] text-white/20">0{ci + 1}</span>
                  <c.icon className="mt-3 size-6 text-primary/80" strokeWidth={1.75} />
                  <p className="mt-4 text-[15px] font-semibold text-white">{c.name}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/40">{c.blurb}</p>
                  <p className="mt-4 flex items-center gap-1 text-[12px] font-medium text-white/30 transition-colors group-hover:text-primary">
                    Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-[1080px] px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, si) => (
              <Reveal key={s.n} delay={si * 90}>
                <div className="relative h-full rounded-2xl border border-white/[0.06] p-6">
                  <span className="font-mono text-[13px] text-primary/50">{s.n}</span>
                  <p className="mt-3 font-heading text-xl font-semibold text-white">{s.t}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/40">{s.d}</p>
                  {si < STEPS.length - 1 ? (
                    <ArrowRight className="absolute -right-4 top-1/2 hidden size-4 -translate-y-1/2 text-white/15 sm:block" />
                  ) : null}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1080px] px-6 pb-24 text-center">
          <Reveal>
            <div className="glass-panel relative overflow-hidden rounded-3xl border border-white/[0.08] px-6 py-14 sm:py-16">
              <span className="float-particle pointer-events-none absolute left-[12%] top-[20%] h-2 w-2 rounded-full bg-primary/30" />
              <span className="float-particle-delay pointer-events-none absolute right-[16%] top-[30%] h-1.5 w-1.5 rounded-full bg-primary/20" />
              <span className="float-particle-delay-2 pointer-events-none absolute bottom-[22%] left-[28%] h-1.5 w-1.5 rounded-full bg-primary/25" />
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
              <p className="mt-5 text-[12px] text-white/25">Free plan · no card required · keep everything you make</p>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-12">
        <div className="mx-auto grid max-w-[1200px] gap-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/genalot-icon.png" alt="Genalot" className="h-7 w-7 rounded-md" />
              <span className="text-[14px] font-semibold text-white/80">Genalot</span>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-white/30">
              The AI creation suite that closes the loop — from one line of text to finished ads,
              images and film, scheduled and posted.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">Product</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="#showcase" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Showcase</Link>
              <Link href="/pricing" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Pricing</Link>
              <Link href="/ad-studio" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Open the studio</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">Account</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/login" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Log in</Link>
              <Link href="/signup" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Sign up</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1200px] items-center justify-between border-t border-white/[0.05] pt-6">
          <p className="text-[11.5px] text-white/20">© 2026 Genalot. All renders on this page are real Genalot output.</p>
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
