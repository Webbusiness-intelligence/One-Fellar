"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Upload,
  Plus,
  Loader2,
  Trash2,
  Copy,
  Check,
  User,
  Package,
  MapPin,
  Box,
  Palette,
  Shapes,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { waitForJob } from "@/lib/ai-ads/wait-job";
import { MentionTextarea } from "../mention-textarea";
import { GeneratingPanel } from "../generating";

export type SoulItem = {
  id: string;
  handle: string;
  name: string;
  kind: string;
  source: string;
  url: string;
};

const KINDS = [
  { id: "character", label: "Character", icon: User, desc: "a person or face" },
  { id: "product", label: "Product", icon: Package, desc: "an item you sell" },
  { id: "location", label: "Location", icon: MapPin, desc: "a place or scene" },
  { id: "prop", label: "Prop", icon: Box, desc: "an object or graphic" },
  { id: "style", label: "Style", icon: Palette, desc: "a look or mood" },
  { id: "logo", label: "Logo / Graphic", icon: Shapes, desc: "a logo or flat graphic" },
] as const;

const DRAFT_KEY = "genalot.soulDraft";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "asset"
  );
}

export function SoulClient({ initial }: { initial: SoulItem[] }) {
  const [items, setItems] = useState<SoulItem[]>(initial);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("character");
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [modelSel, setModelSel] = useState("gpt-image-2");
  const [count, setCount] = useState(1);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [refs, setRefs] = useState<SoulItem[]>([]);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCards(dir: number) {
    scrollerRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  const handlePreview = name ? `@${slugify(name)}` : "@handle";

  async function create() {
    setError(null);
    if (!name.trim()) return setError("Give it a name");

    // Upload registers instantly — keep it synchronous.
    if (mode === "upload") {
      if (!file) return setError("Choose an image to upload");
      setCreating(true);
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("kind", kind);
        fd.set("source", "upload");
        fd.set("file", file);
        const res = await fetch("/api/ai-ads/soul", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        setItems((xs) => [json.soul as SoulItem, ...xs]);
        resetForm();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setCreating(false);
      }
      return;
    }

    // Generate → background job: the worker keeps going if you leave/refresh,
    // and we re-attach to it (and its candidates) on return.
    if (!description.trim()) return setError("Describe what to create");
    setCreating(true);
    setCandidates([]);
    try {
      const fd = new FormData();
      fd.set("kind", "soul");
      fd.set("soulKind", kind);
      fd.set("description", description.trim());
      fd.set("count", String(count));
      const isV2 = modelSel === "gpt-image-2";
      fd.set("model", isV2 ? "gpt-image-2" : "gpt-image-1.5");
      fd.set("quality", isV2 ? "high" : modelSel.replace("1.5-", ""));
      if (refs.length) fd.set("soulIds", JSON.stringify(refs.map((r) => r.id)));
      const res = await fetch("/api/ai-ads/jobs", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.jobId) throw new Error(json.error || "Failed");
      saveDraft(json.jobId);
      await trackJob(json.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setCreating(false);
    }
  }

  function saveDraft(jobId: string) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ jobId, name, kind, count, description }));
    } catch {
      /* ignore */
    }
  }
  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }
  async function trackJob(jobId: string) {
    setCreating(true);
    const res = await waitForJob(jobId);
    if (res.status === "failed") {
      setError(res.error || "Generation failed");
      clearDraft();
      setCreating(false);
      return;
    }
    if (res.status === "timeout") {
      setError("Timed out — try again");
      setCreating(false);
      return;
    }
    try {
      const r = await fetch(`/api/ai-ads/jobs/${jobId}`);
      const j = JSON.parse(await r.text()) as { assets?: { url: string }[] };
      setCandidates((j.assets ?? []).map((a) => a.url));
    } catch {
      /* ignore */
    }
    setCreating(false);
  }

  // Re-attach to any soul generation left running or unsaved (survives refresh
  // and navigating away + back).
  useEffect(() => {
    let draft: { jobId?: string; name?: string; kind?: string; count?: number; description?: string } | null = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      draft = null;
    }
    if (!draft?.jobId) return;
    const jobId = draft.jobId;
    if (draft.name) setName(draft.name);
    if (draft.kind) setKind(draft.kind);
    if (draft.count) setCount(draft.count);
    if (draft.description) setDescription(draft.description);
    setMode("generate");
    (async () => {
      try {
        const r = await fetch(`/api/ai-ads/jobs/${jobId}`);
        if (!r.ok) return clearDraft();
        const j = JSON.parse(await r.text()) as { status?: string; assets?: { url: string }[] };
        if (j.status === "completed") setCandidates((j.assets ?? []).map((a) => a.url));
        else if (j.status === "queued" || j.status === "processing") trackJob(jobId);
        else clearDraft();
      } catch {
        /* keep draft; retry next mount */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setName("");
    setDescription("");
    setFile(null);
    setRefs([]);
    setAtQuery(null);
    setCandidates([]);
    clearDraft();
  }

  // Choose the primary variation (it gets the clean @handle) but KEEP the rest —
  // every variation is saved to the library row. Saved sequentially so the unique
  // -handle suffixing (name, name-2, name-3…) is deterministic, chosen first.
  async function chooseCandidate(url: string, idx: number) {
    setSavingIdx(idx);
    setError(null);
    try {
      const ordered = [url, ...candidates.filter((u) => u !== url)];
      const saved: SoulItem[] = [];
      for (const u of ordered) {
        const fd = new FormData();
        fd.set("name", name.trim() || "Untitled");
        fd.set("kind", kind);
        fd.set("source", "chat");
        fd.set("sourceUrl", u);
        const res = await fetch("/api/ai-ads/soul", { method: "POST", body: fd });
        const json = await res.json();
        if (res.ok && json.soul) saved.push(json.soul as SoulItem);
      }
      if (!saved.length) throw new Error("Couldn't save");
      setItems((xs) => [...saved, ...xs]);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingIdx(null);
    }
  }

  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await fetch(`/api/ai-ads/soul/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function copyHandle(h: string) {
    navigator.clipboard?.writeText(`@${h}`).catch(() => {});
    setCopied(h);
    setTimeout(() => setCopied((c) => (c === h ? null : c)), 1200);
  }

  // @-mention existing Soul IDs in the description to use them as references.
  function onDescInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDescription(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    setAtQuery(m ? m[2].toLowerCase() : null);
  }
  function pickRef(s: SoulItem) {
    setDescription((prev) => prev.replace(/(^|\s)@([a-zA-Z0-9_-]*)$/, `$1@${s.handle} `));
    setRefs((xs) => (xs.some((x) => x.id === s.id) ? xs : [...xs, s].slice(0, 4)));
    setAtQuery(null);
  }
  const refMatches =
    atQuery === null
      ? []
      : items
          .filter(
            (s) => s.handle.toLowerCase().includes(atQuery) || s.name.toLowerCase().includes(atQuery),
          )
          .slice(0, 50);
  const refHandles = new Set(items.map((s) => s.handle.toLowerCase()));
  function onDescKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && atQuery !== null) {
      setAtQuery(null);
      return;
    }
    if (e.key === "Enter" && atQuery !== null && refMatches.length) {
      e.preventDefault();
      pickRef(refMatches[0]);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <div className="text-lg font-semibold text-foreground">Soul ID</div>
        <p className="text-sm text-muted-foreground">
          Create reusable characters, products, locations and styles. Each gets an{" "}
          <span className="text-foreground/80">@handle</span> you can drop into any Create chat to
          keep it consistent.
        </p>
      </div>

      {/* Create panel */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-card/50 p-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Aurora founder)"
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary"
          />
          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[12px] text-primary">
            {handlePreview}
          </span>
        </div>

        {/* Kind pills */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const on = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                  on
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-foreground/80 hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" /> {k.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          {KINDS.find((x) => x.id === kind)?.label} —{" "}
          {KINDS.find((x) => x.id === kind)?.desc}.
        </p>

        {/* Mode toggle */}
        <div className="mt-3 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 w-fit">
          {(["generate", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                mode === m ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "generate" ? <Sparkles className="size-3.5" /> : <Upload className="size-3.5" />}
              {m}
            </button>
          ))}
        </div>
        {mode === "generate" ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Already have the image — a logo, a photo, a product shot?{" "}
            <button
              type="button"
              onClick={() => setMode("upload")}
              className="font-medium text-primary hover:underline"
            >
              Switch to Upload
            </button>{" "}
            instead of generating.
          </p>
        ) : null}

        {/* Mode body */}
        <div className="mt-3">
          {mode === "generate" ? (
            <div className="relative">
              {atQuery !== null && refMatches.length > 0 ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    Reference a Soul ID{atQuery ? ` matching “${atQuery}”` : ""}
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
                value={description}
                onChange={onDescInput}
                onKeyDown={onDescKey}
                rows={2}
                placeholder="Describe it in detail — appearance, materials, mood… use @ to reference a Soul ID"
                handles={refHandles}
                boxClassName="rounded-lg border border-white/10 bg-white/5 focus-within:border-primary"
                fieldClassName="px-3 py-2 text-sm"
              />
              {refs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
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
                        aria-label="Remove reference"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
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
              <Plus className="size-4" />
              {mode === "upload" ? "Choose image" : "Reference image"}
            </button>
            {file ? (
              <span className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[12px] text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="size-6 rounded object-cover" />
                {file.name.slice(0, 24)}
                <button type="button" onClick={() => setFile(null)} aria-label="Remove">
                  <X className="size-3.5 hover:text-foreground" />
                </button>
              </span>
            ) : null}

            {mode === "generate" ? (
              <select
                value={modelSel}
                onChange={(e) => setModelSel(e.target.value)}
                title="GPT image model & quality"
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] text-foreground/80 outline-none transition-colors hover:border-white/25"
              >
                <option value="gpt-image-2">GPT Image 2 · latest</option>
                <option value="1.5-high">GPT Image 1.5 · Best</option>
                <option value="1.5-medium">GPT Image 1.5 · HD</option>
                <option value="1.5-low">GPT Image 1.5 · Standard</option>
              </select>
            ) : null}
            {mode === "generate" ? (
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                title="How many variations to generate (then pick your favourite)"
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] text-foreground/80 outline-none transition-colors hover:border-white/25"
              >
                <option value={1}>1 variation</option>
                <option value={2}>2 variations</option>
                <option value={4}>4 variations</option>
              </select>
            ) : null}
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="ad-cta ml-auto flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium disabled:opacity-50"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {creating ? "Creating…" : "Create Soul ID"}
            </button>
          </div>
          {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
        </div>
      </div>

      {creating && mode === "generate" ? (
        <div className="mb-6">
          <GeneratingPanel count={count} prompt={description} />
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-foreground">
              Pick which to use as{" "}
              <span className="font-mono text-primary">{handlePreview}</span> — the rest stay in your
              library too. Click an image to view it full size.
            </div>
            <button
              type="button"
              onClick={() => {
                setCandidates([]);
                clearDraft();
              }}
              disabled={savingIdx !== null}
              className="text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Discard
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {candidates.map((url, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => setView(url)}
                  aria-label="View full size"
                  className="block size-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => chooseCandidate(url, i)}
                    disabled={savingIdx !== null}
                    className="ad-cta pointer-events-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
                  >
                    {savingIdx === i ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Saving…
                      </>
                    ) : (
                      "Use this"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Library */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-6 text-primary" strokeWidth={2} />
          </div>
          <p className="text-sm text-muted-foreground">
            No Soul IDs yet — create your first character, product or location above.
          </p>
        </div>
      ) : (
        <div className="group/scroller relative">
          <div
            ref={scrollerRef}
            className="flex snap-x snap-proximity gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((it) => {
              const K = KINDS.find((k) => k.id === it.kind);
              const Icon = K?.icon ?? Sparkles;
              return (
                <div
                  key={it.id}
                  className="group w-52 shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-card/40"
                >
                <div className="relative aspect-square bg-white/5">
                  <button
                    type="button"
                    onClick={() => setView(it.url)}
                    aria-label="View full size"
                    className="block size-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.url}
                      alt={it.name}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </button>
                  <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Icon className="size-3" /> {K?.label ?? it.kind}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    aria-label="Delete"
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{it.name}</div>
                    <button
                      type="button"
                      onClick={() => copyHandle(it.handle)}
                      title="Copy handle"
                      className="flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                    >
                      {copied === it.handle ? <Check className="size-3" /> : <Copy className="size-3" />}@
                      {it.handle}
                    </button>
                  </div>
                </div>
                </div>
              );
            })}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setView(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[96vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
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
