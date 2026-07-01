"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Plus, Power, Sparkles, Trash2, Upload, X, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { PillSelect } from "../ad-studio/pill-select";

interface Rule {
  id: string;
  name: string;
  prompt: string;
  platforms: string[];
  interval_hours: number;
  next_run_at: string;
  active: boolean;
}
interface Soul {
  id: string;
  handle: string;
  name: string;
  kind: string;
  url: string;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FREQ = [
  { label: "Daily", hours: 24 },
  { label: "Every 3 days", hours: 72 },
  { label: "Weekly", hours: 168 },
];
const FORMATS = [
  { label: "Square 1:1", v: "1:1" },
  { label: "Story 9:16", v: "9:16" },
  { label: "Portrait 4:5", v: "4:5" },
];
const MOODS = ["auto", "cinematic", "minimal", "vibrant", "luxury", "playful", "moody", "bright"];
// Image models. "auto" = GPT Image 2 when refs/Souls are attached, else 1.5. The
// prompt-only models ignore references/Souls.
const MODELS = [
  { v: "auto", label: "Model: auto" },
  { v: "gpt-image-2", label: "GPT Image 2 · best" },
  { v: "gpt-image-1.5", label: "GPT Image 1.5" },
  { v: "nano-banana-pro", label: "Nano Banana Pro" },
  { v: "nano-banana", label: "Nano Banana" },
  { v: "imagen4-ultra", label: "Imagen 4 Ultra" },
  { v: "flux-pro", label: "Flux Pro 1.1" },
  { v: "recraft", label: "Recraft V3" },
  { v: "ideogram", label: "Ideogram V3" },
];
const cadence = (h: number) =>
  h === 24 ? "Daily" : h === 72 ? "Every 3 days" : h === 168 ? "Weekly" : `Every ${Math.round(h / 24)}d`;

export function AutopilotPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [assets, setAssets] = useState<{ id: string; url: string }[]>([]);
  const [souls, setSouls] = useState<Soul[]>([]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Autopilot");
  const [prompt, setPrompt] = useState("");
  const [autoCaption, setAutoCaption] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [format, setFormat] = useState("1:1");
  const [mood, setMood] = useState("auto");
  const [model, setModel] = useState("auto");
  const [hours, setHours] = useState(168);
  const [startAt, setStartAt] = useState("");
  const [mention, setMention] = useState<{ query: string; caret: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/social/autopilot");
    const j = await r.json();
    if (r.ok) setRules(j.rules ?? []);
  }
  useEffect(() => {
    load();
    fetch("/api/social/accounts").then((r) => r.json()).then((j) => setAccounts(j.accounts ?? [])).catch(() => {});
    fetch("/api/social/assets").then((r) => r.json()).then((j) => setAssets(j.assets ?? [])).catch(() => {});
    fetch("/api/ai-ads/soul").then((r) => r.json()).then((j) => setSouls(j.souls ?? [])).catch(() => {});
  }, []);

  const flip = <T,>(set: (u: (c: T[]) => T[]) => void, v: T) =>
    set((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));

  // @-mention: detect the token being typed and offer souls.
  function onPrompt(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setPrompt(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/@([a-zA-Z0-9_-]*)$/);
    setMention(m ? { query: m[1].toLowerCase(), caret } : null);
  }
  const matches = mention
    ? souls.filter((s) => s.handle.toLowerCase().includes(mention.query) || s.name.toLowerCase().includes(mention.query)).slice(0, 6)
    : [];
  function pickMention(s: Soul) {
    if (!mention) return;
    const before = prompt.slice(0, mention.caret).replace(/@([a-zA-Z0-9_-]*)$/, `@${s.handle} `);
    setPrompt(before + prompt.slice(mention.caret));
    setMention(null);
  }
  const usedSouls = souls.filter((s) => new RegExp(`@${s.handle}(?![a-zA-Z0-9_-])`, "i").test(prompt));

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("file", f);
      const r = await fetch("/api/social/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.url) setRefUrls((c) => [...c, j.url]);
      else setErr(j.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function create() {
    setErr("");
    if (!prompt.trim()) return setErr("Describe what to generate.");
    if (!platforms.length) return setErr("Pick at least one platform.");
    setBusy(true);
    try {
      const r = await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, prompt, autoCaption, platforms, refUrls, soulIds: usedSouls.map((s) => s.id),
          format, mood, model, intervalHours: hours, startAt: startAt || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't create.");
      setOpen(false);
      setPrompt(""); setRefUrls([]); setStartAt("");
      load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  async function patch(id: string, body: object) {
    await fetch(`/api/social/autopilot/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function runNow(id: string) {
    setRunning(id);
    await patch(id, { runNow: true });
    setTimeout(() => setRunning(null), 2500);
  }
  async function remove(id: string) {
    await fetch(`/api/social/autopilot/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="glass-panel mt-6 rounded-2xl border border-white/[0.07] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[16px] font-semibold text-foreground">
          <Zap className="h-4 w-4 text-primary" /> Autopilot
        </div>
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/55 transition-all hover:border-white/10 hover:bg-white/[0.06] hover:text-white/80">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <p className="mb-4 mt-1 text-[12px] text-white/40">
        Lock in your brand — reference images, Soul IDs and mood — and it auto-generates on-brand posts on a schedule.
      </p>

      {open && (
        <div className="mb-4 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-primary/30 focus:shadow-[0_0_20px_rgb(245_227_29_/_0.06)]" />

          {/* Prompt with @-mention */}
          <div className="relative">
            <textarea value={prompt} onChange={onPrompt} rows={2}
              placeholder="What to make each time — type @ to feature a Soul ID (character, product, logo…)"
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-primary/30 focus:shadow-[0_0_20px_rgb(245_227_29_/_0.06)]" />
            {matches.length > 0 && (
              <div className="dropdown-solid animate-fade-in-up absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl">
                {matches.map((s) => (
                  <button key={s.id} onClick={() => pickMention(s)}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" className="h-6 w-6 rounded object-cover" />
                    <span className="font-medium text-white/80">@{s.handle}</span>
                    <span className="text-white/40">{s.name} · {s.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {usedSouls.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              Always featured:
              {usedSouls.map((s) => (
                <span key={s.id} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">@{s.handle}</span>
              ))}
            </div>
          )}

          {/* Reference images — upload or pick */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Reference images (keeps it on-brand)</span>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1 text-[11px] text-primary disabled:opacity-50">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </div>
            {refUrls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {refUrls.map((u) => (
                  <div key={u} className="relative h-14 w-14 overflow-hidden rounded-md border border-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setRefUrls((c) => c.filter((x) => x !== u))}
                      className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {assets.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {assets.map((a) => (
                  <button key={a.id} onClick={() => flip(setRefUrls, a.url)}
                    className={cn("h-12 w-12 shrink-0 overflow-hidden rounded-md border-2",
                      refUrls.includes(a.url) ? "border-primary" : "border-transparent hover:border-primary/40")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caption */}
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={autoCaption} onChange={(e) => setAutoCaption(e.target.checked)} />
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Auto-write a fresh caption each time
          </label>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1.5">
            {accounts.length ? accounts.map((p) => (
              <button key={p} onClick={() => flip(setPlatforms, p)}
                className={cn("rounded-xl border px-3 py-2 text-[12px] font-medium transition-all",
                  platforms.includes(p)
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-white/[0.06] bg-white/[0.03] text-white/40 hover:border-white/10 hover:text-white/60")}>
                {title(p)}
              </button>
            )) : <span className="text-xs text-white/40">Connect accounts first.</span>}
          </div>

          {/* Mood + format + model + cadence + start */}
          <div className="flex flex-wrap items-center gap-2">
            <PillSelect value={mood} onChange={setMood} active={mood !== "auto"}
              options={MOODS.map((m) => ({ v: m, label: m === "auto" ? "Mood: auto" : title(m) }))} />
            <PillSelect value={format} onChange={setFormat} active={format !== "1:1"}
              options={FORMATS.map((f) => ({ v: f.v, label: f.label }))} />
            <PillSelect value={model} onChange={setModel} active={model !== "auto"}
              title="Image model — prompt-only models ignore references/Souls (auto-bumped to GPT Image 2 when refs are attached)"
              options={MODELS} />
            <PillSelect value={String(hours)} onChange={(v) => setHours(Number(v))} active={hours !== 168}
              options={FREQ.map((f) => ({ v: String(f.hours), label: f.label }))} />
            <label className="flex items-center gap-1.5 text-[12px] text-white/40">
              Start
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/70 outline-none focus:border-primary/30" />
            </label>
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-[12px] text-white/40 transition-colors hover:text-white/70">Cancel</button>
            <button onClick={create} disabled={busy}
              className="ad-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      {rules.length ? (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-primary/15">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-white/40">
                  {cadence(r.interval_hours)} · {r.platforms.map(title).join(", ")} · next {new Date(r.next_run_at).toLocaleString()}
                </div>
              </div>
              <button onClick={() => runNow(r.id)} disabled={running === r.id} title="Run now"
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/70 transition-all hover:border-white/10 hover:text-white/90 disabled:opacity-50">
                {running === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {running === r.id ? "Queued" : "Run now"}
              </button>
              <button onClick={() => patch(r.id, { active: !r.active })} title={r.active ? "Pause" : "Resume"}
                className={cn("rounded-md p-1.5", r.active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                <Power className="h-4 w-4" />
              </button>
              <button onClick={() => remove(r.id)} title="Delete" className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No autopilots yet.</p>
      )}
    </div>
  );
}
