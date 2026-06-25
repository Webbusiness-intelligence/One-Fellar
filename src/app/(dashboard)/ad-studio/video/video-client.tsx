"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Plus, Loader2, Trash2, X, ChevronLeft, ChevronRight, Volume2, VolumeX, Scissors } from "lucide-react";
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

const RESOLUTIONS = ["720p", "1080p", "4k"];

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
  const RES_MULT: Record<string, number> = { "480p": 0.45, "720p": 1, "1080p": 2.25, "4k": 5.1 };
  const resMult = supportsRes ? RES_MULT[resolution] ?? 1 : 1;
  const usesReference = supportsRes && refs.length > 0;
  const perTake = engineSec * duration * resMult * 100 + (usesReference ? 0 : 10);
  const credits = Math.round(perTake * count);
  const soulHandles = new Set(souls.map((s) => s.handle.toLowerCase()));
  const PILL =
    "cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] text-foreground/80 outline-none transition-colors hover:border-white/25";

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

      const started = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        if (Date.now() - started > 15 * 60 * 1000) throw new Error("Timed out waiting for the render");
        const sres = await fetch(`/api/ai-ads/jobs/${j.jobId}`);
        const sraw = await sres.text();
        let s: { status?: string; error?: string; assets?: VideoItem[] } | null = null;
        try {
          s = JSON.parse(sraw);
        } catch {
          continue; // a transient blip — keep polling
        }
        if (!s) continue;
        if (s.status === "completed") {
          const vids = (s.assets ?? []).filter((a) => (a as { type?: string }).type === "video");
          setItems((xs) => [...vids, ...xs]);
          setPrompt("");
          setFile(null);
          setRefs([]);
          setAtQuery(null);
          break;
        }
        if (s.status === "failed") throw new Error(s.error || "The video didn't render");
      }
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
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <div className="text-lg font-semibold text-foreground">Video</div>
        <p className="text-sm text-muted-foreground">
          Describe a clip and generate it. Add a start frame with{" "}
          <span className="text-foreground/80">＋</span>, or bring in one or more saved assets with{" "}
          <span className="text-foreground/80">@</span> — Seedance 2.0 seeds them as references and keeps several
          subjects consistent throughout.
        </p>
      </div>

      {/* Create panel */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-card/50 p-3 backdrop-blur-sm">
        <div className="relative">
          {atQuery !== null && refMatches.length > 0 ? (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                Add a Soul ID subject{atQuery ? ` matching “${atQuery}”` : ""}
              </div>
              {refMatches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickRef(s)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="size-8 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{s.name}</span>
                    <span className="block truncate font-mono text-[11px] text-primary">@{s.handle}</span>
                  </span>
                  <span className="text-[10px] capitalize text-muted-foreground">{s.kind}</span>
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
            boxClassName="rounded-lg border border-white/10 bg-white/5 focus-within:border-primary"
            fieldClassName="px-3 py-2 text-sm"
          />
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
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] text-foreground/80 transition-colors hover:text-foreground"
          >
            <Plus className="size-4" /> Start image
          </button>
          <select value={engine} onChange={(e) => setEngine(e.target.value)} title="Video engine" className={PILL}>
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          {supportsRes ? (
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              title="Resolution / quality"
              className={PILL}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "4k" ? "4K" : r}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            title="Clip length"
            className={PILL}
          >
            {durationsFor(engine).map((d) => (
              <option key={d} value={d}>
                {d} seconds
              </option>
            ))}
          </select>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            title="How many variations to generate"
            className={PILL}
          >
            <option value={1}>1 variation</option>
            <option value={2}>2 variations</option>
            <option value={4}>4 variations</option>
          </select>
          {supportsAudio ? (
            <button
              type="button"
              onClick={() => setAudio((v) => !v)}
              title={audio ? "Sound on" : "Sound off"}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors ${
                audio
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {audio ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {audio ? "Sound on" : "Sound off"}
            </button>
          ) : (
            <span
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] text-muted-foreground"
              title="This engine renders silent video"
            >
              <VolumeX className="size-4" /> No sound
            </span>
          )}
          <button
            type="button"
            onClick={() => setCinematic((v) => !v)}
            title={cinematic ? "Cinematic director on — applies realistic film craft" : "Raw prompt (director off)"}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors ${
              cinematic
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-4" />
            Cinematic
          </button>
          {cinematic ? (
            <>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                title="Mood / style — Auto lets the director choose by scene"
                className={PILL}
              >
                <option value="auto">Mood: Auto</option>
                <option value="romantic">Romantic</option>
                <option value="cinematic">Cinematic</option>
                <option value="documentary">Documentary</option>
                <option value="fashion">Fashion</option>
                <option value="music video">Music video</option>
                <option value="noir">Noir</option>
                <option value="luxury">Luxury</option>
                <option value="ugc">UGC / social</option>
                <option value="commercial">Commercial / ad</option>
              </select>
              <button
                type="button"
                onClick={() => setCuts((v) => !v)}
                title={
                  cuts
                    ? "Cut-to-cut on — renders multiple shots of the same subject and edits them together"
                    : "Single continuous shot"
                }
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors ${
                  cuts
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scissors className="size-4" />
                Cuts
              </button>
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-6 text-primary" strokeWidth={2} />
          </div>
          <p className="text-sm text-muted-foreground">No videos yet — describe your first clip above.</p>
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
