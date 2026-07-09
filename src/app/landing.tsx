"use client";

// Public marketing landing — Pixovid/Higgsfield-style structure: compact hero →
// full-bleed template banner → featured carousel → autoplaying masonry wall →
// second banner → closing CTA. Every clip is REAL Genalot output (our storage,
// our prompts) rendered in our yellow/dark design language.
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";

import { AmbientBackground } from "@/components/layout/ambient-background";

const CDN = "https://jjrrwhmvanhmfildtgfw.supabase.co/storage/v1/object/public/ad-studio/";

type Aspect = "portrait" | "landscape" | "square" | "tall";

const ASPECT_CLASS: Record<Aspect, string> = {
  portrait: "aspect-[3/4]",
  landscape: "aspect-video",
  square: "aspect-square",
  tall: "aspect-[9/16]",
};

interface ShowcaseClip {
  title: string;
  prompt: string;
  model: string;
  category: string;
  aspect: Aspect;
  src: string;
  res?: string;
}

// ---- The wall — all real renders, 720p sources for bandwidth ----------------
const SHOWCASE: ShowcaseClip[] = [
  {
    title: "Fairy run",
    prompt:
      "A young fairy boy runs, leaps and climbs through a colossal jungle of mile-high trees — one continuous chase shot filmed from behind.",
    model: "seedance-2.0",
    category: "Film",
    aspect: "landscape",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/e381b1a6-7dbd-4f2a-92c9-bf2d2e66ee45/0.mp4",
  },
  {
    title: "Aura serum",
    prompt: "Luxury skincare advertisement for AURA radiance serum — vertical spot, glass and golden light.",
    model: "seedance-2.0",
    category: "Ad",
    aspect: "tall",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/c6e5a347-760d-41b3-b82a-3a1cc1e6b405/0.mp4",
  },
  {
    title: "Runway night",
    prompt: "A fashion runway show at night — one model walks the line under hard spotlights.",
    model: "seedance-2.0-fast",
    category: "Film",
    aspect: "landscape",
    src: CDN + "outputs/a0654e5c-3f9f-497b-aaea-da56d3b82767/7e1f682d-1a38-4966-bed2-6cf55c60a967/0.mp4",
  },
  {
    title: "Quick cuts",
    prompt: "Beauty close-up of a woman — a sequence of quick cuts across her face, creator-style energy.",
    model: "seedance-2.0-fast",
    category: "UGC",
    aspect: "tall",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/69073f60-c6f0-468d-bd2e-65dacfbcfe0f/0.mp4",
  },
  {
    title: "Macro fairy",
    prompt: "Extreme macro cinematic close-up of a tiny woodland fairy — native 4K detail.",
    model: "seedance-2.0",
    category: "Film",
    aspect: "square",
    src: "/showcase/genalot-4k-2.mp4",
    res: "4K",
  },
  {
    title: "Coastal drive",
    prompt: "A sleek black sports car driving a winding coastal highway at golden hour.",
    model: "seedance-2.0",
    category: "Film",
    aspect: "landscape",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/ed3fe15c-af75-4c0a-86a9-8cc8d6d64e52/0.mp4",
  },
  {
    title: "Beauty portrait",
    prompt: "Extreme close-up cinematic beauty portrait — soft directional light, real skin texture.",
    model: "seedance-2.0",
    category: "Film",
    aspect: "landscape",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/1da3d416-9196-4a94-89a1-912f79bd47ff/0.mp4",
  },
  {
    title: "Autumn glow",
    prompt: "The Sienna Candle Co. “Autumn Glow” amber candle — a full commercial, directed and cut automatically.",
    model: "commercial",
    category: "Ad",
    aspect: "landscape",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/4e530a33-fde4-442c-943e-68a2b74c04ea/0.mp4",
  },
  {
    title: "Night drive",
    prompt: "Driving through the city at night — cinematic tracking shot, neon reflections.",
    model: "seedance-2.0",
    category: "Film",
    aspect: "landscape",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/e9fe8448-8fcc-4b37-bcb7-c4177ac1367c/0.mp4",
  },
  {
    title: "Serum II",
    prompt: "AURA radiance serum, take two — same product, alternate direction. Soul IDs keep it identical.",
    model: "seedance-2.0",
    category: "Ad",
    aspect: "tall",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/c7f28634-07a7-4399-a4b9-bcf1d7032869/0.mp4",
  },
  {
    title: "Candle push-in",
    prompt: "Warm autumn candle scene with an elegant push-in — cozy elements, subtle motion.",
    model: "kling-3",
    category: "Ad",
    aspect: "square",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/1711569e-574c-41ed-89ca-7ec87d69954f/0.mp4",
  },
  {
    title: "Cozy ember",
    prompt: "Warm autumn glow — candle, cozy elements, subtle motion for a product loop.",
    model: "kling-3",
    category: "Ad",
    aspect: "square",
    src: CDN + "outputs/1760158e-57d7-40b6-a035-13a3b62db04a/34d9a6fa-0582-4e0c-8dcb-27a4cda23c32/0.mp4",
  },
];

const FEATURED = [SHOWCASE[4], SHOWCASE[0], SHOWCASE[6], SHOWCASE[5], SHOWCASE[2], SHOWCASE[8]];

// ---- Full-bleed template banners --------------------------------------------
const BANNERS = [
  {
    kicker: "Seedance 2.0 · native 4K",
    title: "Dragon flight",
    subtitle: "Fly through impossible worlds",
    src: "/showcase/genalot-4k-1.mp4",
  },
  {
    kicker: "One continuous shot · 15 seconds",
    title: "Fairy run",
    subtitle: "Typed, not filmed",
    src: CDN + "outputs/c116b899-f1bc-4829-88c1-d1ae56aca2e3/e381b1a6-7dbd-4f2a-92c9-bf2d2e66ee45/0.mp4",
  },
];

function Clip({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video className={className} src={src} autoPlay muted loop playsInline preload="metadata" />
  );
}

function FeaturedCard({ clip }: { clip: ShowcaseClip }) {
  return (
    <div className="group w-[300px] shrink-0 snap-start sm:w-[440px] lg:w-[520px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
        <Clip src={clip.src} className="aspect-video h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {clip.res ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold tracking-tight text-primary-foreground">
            {clip.res}
          </span>
        ) : null}
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {clip.model}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-white">{clip.title}</h3>
      <p className="mt-1 line-clamp-1 text-sm text-white/40">{clip.prompt}</p>
    </div>
  );
}

function MasonryTile({ clip }: { clip: ShowcaseClip }) {
  return (
    <div className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-lg shadow-black/30">
      <div className={`relative w-full ${ASPECT_CLASS[clip.aspect]}`}>
        <Clip src={clip.src} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {clip.model}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
          {clip.category}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h4 className="text-sm font-bold uppercase tracking-wide text-white drop-shadow">{clip.title}</h4>
          <p className="mt-1 line-clamp-2 max-h-0 overflow-hidden text-sm leading-5 text-white/85 opacity-0 transition-all duration-300 group-hover:max-h-20 group-hover:opacity-100">
            {clip.prompt}
          </p>
        </div>
      </div>
    </div>
  );
}

function TemplateBanner({ banner }: { banner: (typeof BANNERS)[number] }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        className="aspect-[16/11] w-full object-cover transition-transform duration-700 group-hover:scale-105 sm:aspect-[16/6]"
        src={banner.src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/80 via-black/15 to-transparent" />
      <span className="absolute right-4 top-4 -skew-x-6 rounded bg-primary px-2.5 py-0.5 text-base font-extrabold tracking-tight text-primary-foreground sm:right-6 sm:top-6 sm:text-xl">
        4K
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex max-w-2xl flex-col items-start p-5 text-left sm:p-8">
        <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur sm:text-xs">
          {banner.kicker}
        </span>
        <h3 className="mt-2 font-heading text-3xl font-extrabold uppercase tracking-tight text-primary drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)] sm:text-5xl">
          {banner.title}
        </h3>
        <p className="mt-1 text-sm font-bold uppercase tracking-wide text-white/90 drop-shadow sm:text-base">
          {banner.subtitle}
        </p>
        <div className="pointer-events-auto mt-4">
          <Link href="/signup" className="ad-cta inline-flex items-center gap-2 rounded-full px-8 py-3 text-[14px] font-semibold">
            Try it now <ArrowRight className="size-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div className="genalot-canvas relative min-h-screen overflow-hidden bg-[#050508] text-white">
      <AmbientBackground />

      {/* Nav */}
      <nav className="relative z-40 mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
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

      <main className="relative z-10 overflow-hidden">
        {/* Compact hero */}
        <section className="mx-auto max-w-[1600px] px-4 pt-12 pb-8 lg:px-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/50">
            <Sparkles className="h-4 w-4 text-primary" />
            Real clips, real prompts — generated in Genalot
          </div>
          <h1 className="max-w-4xl font-heading text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            The studio where <span className="text-primary">AI video</span> comes to life.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/45">
            Browse a living wall of cinematic clips, ads and UGC — then generate your own in native
            4K, and auto-post it to your channels. Generate. Publish. Convert.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="ad-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold">
              Start creating <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-[14px] font-medium text-white/80 transition-all hover:border-white/[0.2] hover:bg-white/[0.06]"
            >
              Explore the studio <Play className="size-4" />
            </Link>
          </div>
        </section>

        {/* Featured banner */}
        <section className="mx-auto max-w-[1600px] px-4 pb-12 lg:px-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Featured</h2>
          <TemplateBanner banner={BANNERS[0]} />
        </section>

        {/* Featured carousel */}
        <section className="mx-auto max-w-[1600px] px-4 pb-12 lg:px-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Fresh from the studio</h2>
            <span className="text-sm text-white/35">Made with Seedance 2.0 &amp; Kling 3</span>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
            {FEATURED.map((clip) => (
              <FeaturedCard key={clip.title} clip={clip} />
            ))}
          </div>
        </section>

        {/* Masonry wall */}
        <section className="mx-auto max-w-[1600px] px-4 pb-12 lg:px-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Explore the wall</h2>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {SHOWCASE.map((clip) => (
              <MasonryTile key={clip.title} clip={clip} />
            ))}
          </div>
        </section>

        {/* Second banner */}
        <section className="mx-auto max-w-[1600px] px-4 pb-12 lg:px-6">
          <TemplateBanner banner={BANNERS[1]} />
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-[1600px] px-4 pb-24 lg:px-6">
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
            <h2 className="font-heading text-2xl font-semibold text-white sm:text-3xl">Your next clip is one prompt away.</h2>
            <p className="max-w-xl text-white/45">
              Pick a model, describe the shot, and render production-ready video, images and ads in
              minutes — then schedule them straight to your channels.
            </p>
            <Link href="/signup" className="ad-cta inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold">
              Start creating <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-12">
        <div className="mx-auto grid max-w-[1200px] gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/genalot-icon.png" alt="Genalot" className="h-7 w-7 rounded-md" />
              <span className="text-[14px] font-semibold text-white/80">Genalot</span>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-white/30">
              Generate. Publish. Convert. The AI suite that turns one prompt into finished ads,
              images and film — auto-posted to your channels and working to bring you leads.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">Product</p>
            <div className="mt-3 flex flex-col gap-2">
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
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">Legal</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/terms" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Terms of Service</Link>
              <Link href="/privacy" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Privacy Policy</Link>
              <Link href="/refund" className="w-fit text-[12.5px] text-white/40 transition-colors hover:text-white/70">Refund Policy</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1200px] items-center justify-between border-t border-white/[0.05] pt-6">
          <p className="text-[11.5px] text-white/20">© 2026 Genalot. Every clip on this page is real Genalot output.</p>
        </div>
      </footer>
    </div>
  );
}
