"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Plus,
  Loader2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Scissors,
  Film,
  Zap,
  Gauge,
  Monitor,
  Clock,
  Copy,
  LayoutGrid,
  GalleryHorizontal,
  Smile,
  Moon,
  Palette,
  Clapperboard,
} from "lucide-react";
import { waitForJob } from "@/lib/ai-ads/wait-job";
import { PillSelect } from "../pill-select";
import { SkillPicker } from "../skill-picker";
import { PromptEnhancer } from "../prompt-enhancer";
import { MentionTextarea } from "../mention-textarea";
import { GeneratingPanel } from "../generating";

export type VideoItem = { id: string; url: string; label: string; duration?: number };
type SoulRef = { id: string; handle: string; name: string; kind: string; url: string };

const ENGINES = [
  { id: "seedance-pro", label: "Seedance 2.0 · Pro", sec: 0.3024 },
  { id: "seedance-fast", label: "Seedance 2.0 · Fast", sec: 0.2419 },
  { id: "kling-pro", label: "Kling Pro · cinematic", sec: 0.168 },
  { id: "kling-turbo", label: "Kling Turbo · fast", sec: 0.07 },
] as const;

const ENGINE_OPTS = [
  { v: "seedance-pro", label: "Seedance 2.0 · Pro", icon: Sparkles },
  { v: "seedance-fast", label: "Seedance 2.0 · Fast", icon: Zap },
  { v: "kling-pro", label: "Kling Pro · cinematic", icon: Film },
  { v: "kling-turbo", label: "Kling Turbo · fast", icon: Gauge },
];
const RES_OPTS = [
  { v: "720p", label: "720p", icon: Monitor },
  { v: "1080p", label: "1080p", icon: Monitor },
  { v: "4k", label: "4K", icon: Monitor },
];
const COUNT_OPTS = [
  { v: "1", label: "1 variation", icon: Copy },
  { v: "2", label: "2 variations", icon: LayoutGrid },
  { v: "4", label: "4 variations", icon: GalleryHorizontal },
];
const MOOD_OPTS = [
  { v: "auto", label: "Mood: Auto", icon: Smile },
  { v: "romantic", label: "Romantic", icon: Sparkles },
  { v: "cinematic", label: "Cinematic", icon: Clapperboard },
  { v: "documentary", label: "Documentary", icon: Film },
  { v: "fashion", label: "Fashion", icon: Palette },
  { v: "music video", label: "Music video", icon: Zap },
  { v: "noir", label: "Noir", icon: Moon },
  { v: "luxury", label: "Luxury", icon: Sparkles },
  { v: "ugc", label: "UGC / social", icon: Smile },
  { v: "commercial", label: "Commercial / ad", icon: Sparkles },
];

// Durations each engine actually supports on fal.
function durationsFor(engine: string): number[] {
  if (engine === "kling-turbo") return [5, 10];
  if (engine.startsWith("seedance")) return [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Seedance 2.0
  return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Kling v3 Pro
}

const VIDEO_STEPS = [
  "Reading your prompt",
  "Setting the opening frame",
  "Directing the camera move",
  "Animating the scene",
  "Rendering & encoding",
];

export function VideoClient({ initial }: { initial: VideoItem[] }) {
  const [items, setItems] = useState<VideoItem[]>(initial);
  const [prompt, setPrompt] = useState("");
  const [engine, setEngine] = useState<string>("seedance-fast");
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState(5);
  const [audio, setAudio] = useState(true);
  const [count, setCount] = useState(1);
  const [cinematic, setCinematic] = useState(true);
  const [cuts, setCuts] = useState(false);
  const [mood, setMood] = useState("auto");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [enhancedKeyframe, setEnhancedKeyframe] = useState<string | undefined>(undefined);
  useEffect(() => {
    setEnhanced(null);
    setEnhancedKeyframe(undefined);
  }, [prompt]);
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [souls, setSouls] = useState<SoulRef[]>([]);
  const [refs, setRefs] = useState<SoulRef[]>([]);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai-ads/soul")
      .then((r) => r.json())
      .then((j: { items?: SoulRef[] }) => setSouls(j.items ?? []))
      .catch(() => {});
  }, []);

  // Keep the chosen length valid when the engine (and its supported range) changes.
  useEffect(() => {
    setDuration((d) => (durationsFor(engine).includes(d) ? d : 5));
  }, [engine]);

  const engineSec = ENGINES.find((e) => e.id === engine)?.sec ?? 0.168;
  const supportsRes = engine.startsWith("seedance");
  const supportsAudio = engine !== "kling-turbo";
  // Seedance is billed by pixels × frames, so resolution scales the cost (the base
  // rate is for 720p). Kling is flat per-second. Plus the GPT-Image-2 keyframe (~10cr)
  // per take, except Seedance reference-to-video (no keyframe).
  const RES_MULT: Record<string, number> = { "480p": 0.45, "720p": 1, "1080p": 2.25, "4k": 9 };
  const resMult = supportsRes ? RES_MULT[resolution] ?? 1 : 1;
  const usesReference = supportsRes && refs.length > 0;
  const perTake = engineSec * duration * resMult * 100 + (usesReference ? 0 : 10);
  const credits = Math.round(perTake * count);
  const soulHandles = new Set(souls.map((s) => s.handle.toLowerCase()));

  function onPromptInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setPrompt(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    setAtQuery(m ? m[2].toLowerCase() : null);
  }
  function pickRef(s: SoulRef) {
    setPrompt((prev) => prev.replace(/(^|\s)@([a-zA-Z0-9_-]*)$/, `$1@${s.handle} `));
    setRefs((xs) => (xs.some((x) => x.id === s.id) ? xs : [...xs, s].slice(0, 4)));
    setAtQuery(null);
  }
  const refMatches =
    atQuery === null
      ? []
      : souls
          .filter(
            (s) => s.handle.toLowerCase().includes(atQuery) || s.name.toLowerCase().includes(atQuery),
          )
          .slice(0, 50);
  function onPromptKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && atQuery !== null) {
      setAtQuery(null);
      return;
    }
    if (e.key === "Enter" && atQuery !== null && refMatches.length) {
      e.preventDefault();
      pickRef(refMatches[0]);
    }
  }

  function scrollByCards(dir: number) {
    scrollerRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  async function create() {
    setError(null);
    if (!prompt.trim()) return setError("Describe the video");
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("kind", "video");
      fd.set("prompt", prompt.trim());
      fd.set("engine", engine);
      fd.set("duration", String(duration));
      if (supportsRes) fd.set("resolution", resolution);
      fd.set("audio", String(supportsAudio && audio));
      fd.set("count", String(count));
      fd.set("cinematic", String(cinematic));
      if (cinematic) fd.set("mood", mood);
      fd.set("cuts", String(cuts && cinematic));
      if (cinematic && skillId) fd.set("skillId", skillId);
      if (enhanced) {
        fd.set("enhancedPrompt", enhanced);
        if (enhancedKeyframe) fd.set("enhancedKeyframe", enhancedKeyframe);
      }
      if (refs.length) fd.set("soulIds", JSON.stringify(refs.map((r) => r.id)));
      if (file) fd.set("file", file);
      // Enqueue → the worker renders → poll for the result (no 3-min held request).
      const res = await fetch("/api/ai-ads/jobs", { method: "POST", body: fd });
      const raw = await res.text();
      let j: { jobId?: string; error?: string } | null = null;
      try {
        j = JSON.parse(raw);
      } catch {
        j = null;
      }
      if (res.status === 402) throw new Error("You're out of credits — top up to generate.");
      if (!res.ok || !j?.jobId) throw new Error((j && j.error) || "Couldn't start the render");

      // Realtime (with polling fallback) — resolves the moment the worker finishes.
      const outcome = await waitForJob(j.jobId);
      if (outcome.status === "failed") throw new Error(outcome.error || "The video didn't render");
      if (outcome.status === "timeout") throw new Error("Timed out waiting for the render");
      const sres = await fetch(`/api/ai-ads/jobs/${j.jobId}`);
      let assets: VideoItem[] = [];
      try {
        assets = ((JSON.parse(await sres.text()) as { assets?: VideoItem[] }).assets ?? []) as VideoItem[];
      } catch {
        /* ignore */
      }
      const vids = assets.filter((a) => (a as { type?: string }).type === "video");
      setItems((xs) => [...vids, ...xs]);
      setPrompt("");
      setFile(null);
      setRefs([]);
      setAtQuery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await fetch(`/api/ai-ads/assets/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-8">
        <h1 className="mb-2 font-heading text-3xl font-semibold text-foreground">Video</h1>
        <p className="text-[13px] leading-relaxed text-white/40">
          Describe a clip and generate it. Add a start frame with{" "}
          <span className="font-medium text-white/60">＋</span>, or bring in one or more saved assets with{" "}
          <span className="font-medium text-primary/70">@</span> — Seedance 2.0 seeds them as references and keeps
          several subjects consistent throughout.
        </p>
      </div>

      {/* Create panel */}
      <div className="glass-panel mb-6 rounded-2xl border border-white/[0.07] p-6">
        <div className="relative">
          {atQuery !== null && refMatches.length > 0 ? (
            <div className="dropdown-solid animate-fade-in-up absolute bottom-full left-0 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl p-1.5">
              <div className="px-2 py-1 text-[11px] font-medium text-white/40">
                Add a Soul ID subject{atQuery ? ` matching “${atQuery}”` : ""}
              </div>
              {refMatches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickRef(s)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="size-8 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{s.name}</span>
                    <span className="block truncate font-mono text-[11px] text-primary">@{s.handle}</span>
                  </span>
                  <span className="text-[10px] capitalize text-white/40">{s.kind}</span>
                </button>
              ))}
            </div>
          ) : null}
          <MentionTextarea
            value={prompt}
            onChange={onPromptInput}
            onKeyDown={onPromptKey}
            rows={2}
            placeholder="Describe the video — the scene, motion and mood… use @ to add one or more Soul ID subjects"
            handles={soulHandles}
            boxClassName="rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all focus-within:border-primary/30 focus-within:shadow-[0_0_20px_rgb(245_227_29_/_0.06)]"
            fieldClassName="px-4 py-3 text-sm"
          />
          <div
            className={`mt-1 pr-1 text-right text-[11px] ${
              prompt.length > 20000 ? "text-amber-400" : "text-muted-foreground/60"
            }`}
          >
            {prompt.length.toLocaleString()} / 20,000
          </div>
        </div>

        {/* Start-frame chips */}
        {file || refs.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {file ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 py-1 pl-1 pr-2 text-[12px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="size-6 rounded object-cover" />
                Start frame
                <button type="button" onClick={() => setFile(null)} aria-label="Remove">
                  <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ) : null}
            {refs.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 py-1 pl-1 pr-2 text-[12px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="size-6 rounded object-cover" />
                <span className="font-mono text-primary">@{s.handle}</span>
                <button
                  type="button"
                  onClick={() => setRefs((xs) => xs.filter((x) => x.id !== s.id))}
                  aria-label="Remove"
                >
                  <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = "";
          }}
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/55 transition-all hover:border-white/10 hover:bg-white/[0.06] hover:text-white/80"
          >
            <Plus className="size-3.5" strokeWidth={2} /> Start image
          </button>
          <PillSelect value={engine} onChange={setEngine} title="Video engine" active icon={Film} options={ENGINE_OPTS} />
          {supportsRes ? (
            <PillSelect
              value={resolution}
              onChange={setResolution}
              title="Resolution / quality"
              active={resolution !== "720p"}
              icon={Monitor}
              options={RES_OPTS}
            />
          ) : null}
          <PillSelect
            value={String(duration)}
            onChange={(v) => setDuration(Number(v))}
            title="Clip length"
            active
            icon={Clock}
            options={durationsFor(engine).map((d) => ({ v: String(d), label: `${d} seconds`, icon: Clock }))}
          />
          <PillSelect
            value={String(count)}
            onChange={(v) => setCount(Number(v))}
            title="How many variations to generate"
            active={count > 1}
            icon={Copy}
            options={COUNT_OPTS}
          />
          {supportsAudio ? (
            <button
              type="button"
              onClick={() => setAudio((v) => !v)}
              title={audio ? "Sound on" : "Sound off"}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
                audio
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/[0.06] bg-white/[0.03] text-white/55 hover:border-white/10 hover:text-white/80"
              }`}
            >
              {audio ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              {audio ? "Sound on" : "Sound off"}
            </button>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/40"
              title="This engine renders silent video"
            >
              <VolumeX className="size-3.5" /> No sound
            </span>
          )}
          <button
            type="button"
            onClick={() => setCinematic((v) => !v)}
            title={cinematic ? "Cinematic director on — applies realistic film craft" : "Raw prompt (director off)"}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
              cinematic
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-white/[0.06] bg-white/[0.03] text-white/55 hover:border-white/10 hover:text-white/80"
            }`}
          >
            <Sparkles className="size-3.5" />
            Cinematic
          </button>
          {cinematic ? (
            <>
              <PillSelect
                value={mood}
                onChange={setMood}
                title="Mood / style — Auto lets the director choose by scene"
                active={mood !== "auto"}
                icon={Smile}
                options={MOOD_OPTS}
              />
              <button
                type="button"
                onClick={() => setCuts((v) => !v)}
                title={
                  cuts
                    ? "Cut-to-cut on — renders multiple shots of the same subject and edits them together"
                    : "Single continuous shot"
                }
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
                  cuts
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-white/[0.06] bg-white/[0.03] text-white/55 hover:border-white/10 hover:text-white/80"
                }`}
              >
                <Scissors className="size-3.5" />
                Cuts
              </button>
              <SkillPicker value={skillId} onChange={setSkillId} kind="video" />
              <PromptEnhancer
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                getParams={() => ({
                  kind: "video",
                  prompt,
                  mood: cinematic ? mood : "auto",
                  aspect: "9:16",
                  soulIds: refs.map((r) => r.id),
                  skillId,
                  engine,
                  duration,
                  cuts: cuts && cinematic,
                })}
                onUse={({ prompt: p, keyframe }) => {
                  setEnhanced(p);
                  setEnhancedKeyframe(keyframe);
                }}
              />
              {enhanced ? (
                <span className="flex h-9 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[12px] text-primary">
                  ✨ edited
                  <button
                    type="button"
                    onClick={() => {
                      setEnhanced(null);
                      setEnhancedKeyframe(undefined);
                    }}
                    title="Clear edited prompt"
                    className="ml-0.5 hover:text-foreground"
                  >
                    ✕
                  </button>
                </span>
              ) : null}
              {cuts && duration < (engine === "kling-pro" ? 6 : engine === "kling-turbo" ? 10 : 8) ? (
                <span className="text-[11px] text-amber-400/80">
                  needs {engine === "kling-pro" ? "6s" : engine === "kling-turbo" ? "10s" : "8s"}+ for cuts
                </span>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="ad-cta ml-auto flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {creating ? "Generating…" : "Generate"}
            <span className="ml-0.5 rounded-md bg-black/20 px-1.5 py-0.5 text-[11px] font-normal">
              {credits}
            </span>
          </button>
        </div>
        {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
      </div>

      {creating ? (
        <div className="mb-6">
          <GeneratingPanel count={count} prompt={prompt} etaSeconds={engine === "kling-pro" ? 110 : 80} steps={VIDEO_STEPS} />
        </div>
      ) : null}

      {/* Library */}
      {items.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <Film className="size-6 text-primary/40" strokeWidth={1} />
          </div>
          <p className="mb-1 text-[14px] text-white/30">No videos yet</p>
          <p className="text-[12px] text-white/20">Describe your first clip above.</p>
        </div>
      ) : (
        <div className="group/scroller relative">
          <div
            ref={scrollerRef}
            className="flex snap-x snap-proximity gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((it) => (
              <div
                key={it.id}
                className="group w-52 shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <div className="relative aspect-square">
                  <button
                    type="button"
                    onClick={() => setView(it.url)}
                    aria-label="View full size"
                    className="block size-full"
                  >
                    <video src={it.url} muted loop playsInline autoPlay className="size-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label="Delete"
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-[12px] text-foreground/80" title={it.label}>
                    {it.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            aria-label="Scroll left"
            className="absolute left-1 top-[42%] hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover/scroller:opacity-100 sm:flex"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            aria-label="Scroll right"
            className="absolute right-1 top-[42%] hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover/scroller:opacity-100 sm:flex"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {view ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setView(null)}
        >
          <video
            src={view}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[92vw] rounded-lg shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setView(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
