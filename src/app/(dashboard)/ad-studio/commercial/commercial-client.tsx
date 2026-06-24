"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Lock, Check, Clapperboard, Sparkles, Film, Plus, Layers } from "lucide-react";

import { sceneCredits } from "@/lib/ai-ads/cost";

export type CommercialProduct = { id: string; name: string; imageUrl: string | null };

type Variation = { id: string; url: string };
type Scene = {
  id: string;
  idx: number;
  summary: string;
  prompt: string;
  duration: number;
  status: string;
  locked: boolean;
  lockedAssetId?: string | null;
  keyframeUrl?: string | null;
  variations: Variation[];
  varCount?: number;
  engine?: string;
};

const PRESETS = [
  { v: "tv_spot", label: "TV Spot" },
  { v: "hyper_motion", label: "Hyper Motion" },
  { v: "ugc", label: "UGC" },
  { v: "unboxing", label: "Unboxing" },
  { v: "product_review", label: "Product Review" },
  { v: "wild_card", label: "Wild Card" },
];
const FORMATS = [
  { v: "9:16", label: "9:16 vertical" },
  { v: "16:9", label: "16:9 wide" },
  { v: "1:1", label: "1:1 square" },
  { v: "4:5", label: "4:5 portrait" },
];
const DURATIONS = [15, 30, 45, 60];
const ENGINES = [
  { v: "kling-pro", label: "Kling Pro (best)" },
  { v: "kling-turbo", label: "Kling Turbo (fast)" },
  { v: "seedance-pro", label: "Seedance 2.0 Pro" },
  { v: "seedance-fast", label: "Seedance 2.0 Fast" },
];

export function CommercialClient({ products }: { products: CommercialProduct[] }) {
  // new-project form
  const [selected, setSelected] = useState<CommercialProduct | null>(products[0] ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [brief, setBrief] = useState("");
  const [duration, setDuration] = useState(30);
  const [preset, setPreset] = useState("tv_spot");
  const [format, setFormat] = useState("9:16");
  const [model, setModel] = useState("kling-pro");
  const [music, setMusic] = useState(true);
  const [voiceover, setVoiceover] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // project
  const [id, setId] = useState<string | null>(null);
  const [bible, setBible] = useState("");
  const [storyline, setStoryline] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  // production assets (@tag reference sheets)
  type AssetCard = { id: string; url: string; tag: string; role: string; label: string };
  const [assets, setAssets] = useState<AssetCard[]>([]);
  const [aRole, setARole] = useState("product");
  const [aTag, setATag] = useState("");
  const [aInstr, setAInstr] = useState("");
  const [aFile, setAFile] = useState<File | null>(null);
  const [assetBusy, setAssetBusy] = useState(false);
  const assetFileInput = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [rendering, setRendering] = useState<Set<string>>(new Set());
  const [stitching, setStitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = file ? URL.createObjectURL(file) : selected?.imageUrl ?? null;
  const lockedCount = scenes.filter((s) => s.locked).length;

  async function create() {
    setError(null);
    let productFile = file;
    if (!productFile && selected?.imageUrl) {
      productFile = new File([await (await fetch(selected.imageUrl)).blob()], "product.png", {
        type: "image/png",
      });
    }
    if (!productFile) {
      setError("Upload or pick a product first");
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("product", productFile);
      fd.set("brief", brief);
      fd.set("duration", String(duration));
      fd.set("preset", preset);
      fd.set("format", format);
      fd.set("model", model);
      fd.set("music", music ? "1" : "0");
      fd.set("voiceover", voiceover ? "1" : "0");
      const r = await fetch("/api/ai-ads/commercial/create", { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Failed");
      const j = (await r.json()) as {
        id: string;
        bible: string;
        storyline: string;
        scenes: Array<{
          id: string;
          idx: number;
          summary: string;
          prompt: string;
          duration: number;
          status: string;
          locked: boolean;
        }>;
      };
      setId(j.id);
      setBible(j.bible);
      setStoryline(j.storyline ?? "");
      setScenes(j.scenes.map((s) => ({ ...s, variations: [] })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  function patchScene(sceneId: string, patch: Partial<Scene>) {
    setScenes((ss) => ss.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)));
  }

  async function saveScene(sceneId: string, body: { prompt?: string; duration?: number }) {
    if (!id) return;
    await fetch(`/api/ai-ads/commercial/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId, ...body }),
    }).catch(() => {});
  }

  async function renderScene(s: Scene) {
    if (!id || rendering.has(s.id)) return;
    setError(null);
    setRendering((r) => new Set(r).add(s.id));
    try {
      const r = await fetch(`/api/ai-ads/commercial/${id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: s.id, variations: s.varCount ?? 2, engine: s.engine ?? model }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Render failed");
      const j = (await r.json()) as {
        keyframe: Variation | null;
        variations: Variation[];
      };
      patchScene(s.id, {
        keyframeUrl: j.keyframe?.url ?? s.keyframeUrl,
        variations: [...s.variations, ...j.variations],
        status: "rendered",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setRendering((r) => {
        const n = new Set(r);
        n.delete(s.id);
        return n;
      });
    }
  }

  async function lock(sceneId: string, assetId: string) {
    patchScene(sceneId, { locked: true, lockedAssetId: assetId });
    await saveScenePatch(sceneId, { locked: true, lockedAssetId: assetId });
  }
  async function unlock(sceneId: string) {
    patchScene(sceneId, { locked: false, lockedAssetId: null });
    await saveScenePatch(sceneId, { locked: false });
  }
  async function saveScenePatch(
    sceneId: string,
    body: { locked?: boolean; lockedAssetId?: string },
  ) {
    if (!id) return;
    await fetch(`/api/ai-ads/commercial/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId, ...body }),
    }).catch(() => {});
  }

  async function genAsset() {
    if (!id || assetBusy || !aInstr.trim()) return;
    setError(null);
    setAssetBusy(true);
    try {
      const fd = new FormData();
      fd.set("role", aRole);
      fd.set("tag", aTag);
      fd.set("instruction", aInstr);
      if (aFile) fd.set("source", aFile);
      const r = await fetch(`/api/ai-ads/commercial/${id}/asset`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Failed");
      const j = (await r.json()) as {
        asset: AssetCard;
        scenes: Array<{
          id: string;
          idx: number;
          summary: string;
          prompt: string;
          duration: number;
          status: string;
          locked: boolean;
        }> | null;
        bibleText?: string;
      };
      setAssets((a) => [...a.filter((x) => !(x.tag === j.asset.tag && x.role === j.asset.role)), j.asset]);
      if (j.scenes) setScenes(j.scenes.map((s) => ({ ...s, variations: [] })));
      if (j.bibleText) setBible(j.bibleText);
      setAInstr("");
      setATag("");
      setAFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAssetBusy(false);
    }
  }

  async function stitch() {
    if (!id || stitching) return;
    setError(null);
    setStitching(true);
    try {
      const r = await fetch(`/api/ai-ads/commercial/${id}/stitch`, { method: "POST" });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Stitch failed");
      const j = (await r.json()) as { asset: { id: string; url: string } };
      setFinalUrl(j.asset.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stitch failed");
    } finally {
      setStitching(false);
    }
  }

  // ---------- NEW PROJECT FORM ----------
  if (!id) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-16">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clapperboard className="size-5 text-primary" /> Commercial studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Give it your product and a brief — it writes a scene-by-scene script you can tweak,
            generate, pick the best take of each scene, lock it, then stitch the final ad.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="eyebrow mb-2">Product</div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setSelected(null);
                }
                e.target.value = "";
              }}
            />
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p);
                  setFile(null);
                }}
                className={`relative size-16 overflow-hidden rounded-lg border ${
                  !file && selected?.id === p.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
                title={p.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                ) : (
                  <div className="size-full bg-muted" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={`flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border text-[10px] text-muted-foreground ${
                file ? "border-primary ring-2 ring-primary/40" : "border-dashed border-border"
              }`}
            >
              {file ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl ?? ""} alt="" className="size-full rounded-lg object-cover" />
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="eyebrow mb-1.5">Brief</div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="What's the ad about? Audience, vibe, key message, any must-haves…"
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="eyebrow mb-1.5">Video engine</div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              title="Which video model renders the scenes"
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary"
            >
              {ENGINES.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="eyebrow mb-1.5">Length</div>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="eyebrow mb-1.5">Ad type</div>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary"
            >
              {PRESETS.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="eyebrow mb-1.5">Format</div>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary"
            >
              {FORMATS.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="eyebrow mb-2">Audio</div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={music}
                onChange={(e) => setMusic(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Music bed (scored at stitch)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={voiceover}
                onChange={(e) => setVoiceover(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Voiceover narration
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Music and voiceover are generated and mixed under the film when you stitch.
          </p>
        </div>

        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="ad-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {creating ? "Writing your script…" : "Generate storyboard"}
        </button>
      </div>
    );
  }

  // ---------- STORYBOARD / WORKBENCH ----------
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clapperboard className="size-5 text-primary" /> Storyboard
          </h1>
          <p className="mt-0.5 max-w-xl text-[13px] text-muted-foreground">{bible}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setId(null);
            setScenes([]);
            setFinalUrl(null);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" /> New
        </button>
      </div>

      {/* Creative treatment — the premium storyline the scenes execute */}
      {storyline ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="eyebrow mb-1.5 flex items-center gap-1.5">
            <Film className="size-3.5" /> Creative treatment
          </div>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">{storyline}</p>
        </div>
      ) : null}

      {/* Production assets — reusable @tag reference sheets for consistency */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="eyebrow mb-2 flex items-center gap-1.5">
          <Layers className="size-3.5" /> Production assets (@tags)
        </div>
        {assets.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {assets.map((a) => (
              <div key={a.id} className="w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.tag}
                  className="h-20 w-full rounded-lg border border-border object-cover"
                />
                <div className="mt-0.5 truncate text-[11px] text-foreground">@{a.tag}</div>
                <div className="text-[10px] text-muted-foreground">{a.role}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-muted-foreground">
            Build reference sheets — generate from your product, or upload a character/image and it
            makes the sheet. Each new asset is woven into the scenes automatically.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input
            ref={assetFileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => assetFileInput.current?.click()}
            title="Upload a reference image / character"
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors ${
              aFile
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="size-3.5" /> {aFile ? "Image ✓" : "Upload"}
          </button>
          <select
            value={aRole}
            onChange={(e) => setARole(e.target.value)}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none"
          >
            <option value="product">Product sheet</option>
            <option value="character">Character</option>
            <option value="location">Location</option>
            <option value="prop">Prop</option>
          </select>
          <input
            value={aTag}
            onChange={(e) => setATag(e.target.value)}
            placeholder="@tag (e.g. hero)"
            className="h-9 w-28 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none focus:border-primary"
          />
          <input
            value={aInstr}
            onChange={(e) => setAInstr(e.target.value)}
            placeholder="Describe it…"
            className="h-9 min-w-40 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={genAsset}
            disabled={assetBusy || !aInstr.trim()}
            className="ad-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium disabled:opacity-50"
          >
            {assetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {assetBusy ? "Generating…" : "Generate sheet"}
          </button>
        </div>
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      {scenes.map((s) => {
        const isRendering = rendering.has(s.id);
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[13px] font-medium text-foreground">
                Scene {s.idx + 1} · <span className="text-muted-foreground">{s.summary}</span>
                {s.locked ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    <Lock className="size-3" /> Locked
                  </span>
                ) : null}
              </div>
              <select
                value={s.duration}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  patchScene(s.id, { duration: d });
                  void saveScene(s.id, { duration: d });
                }}
                className="h-7 rounded-md border border-white/10 bg-white/5 px-1.5 text-[12px] text-foreground outline-none"
              >
                {[3, 5, 10].map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={s.prompt}
              onChange={(e) => patchScene(s.id, { prompt: e.target.value })}
              onBlur={(e) => void saveScene(s.id, { prompt: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-2.5 text-[12px] leading-relaxed text-foreground outline-none focus:border-primary"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={s.engine ?? model}
                onChange={(e) => patchScene(s.id, { engine: e.target.value })}
                title="Video engine for this scene (overrides the project default)"
                className="h-8 rounded-md border border-white/10 bg-white/5 px-1.5 text-[12px] text-foreground outline-none disabled:opacity-50"
                disabled={isRendering}
              >
                {ENGINES.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={s.varCount ?? 2}
                onChange={(e) => patchScene(s.id, { varCount: Number(e.target.value) })}
                title="How many takes (variations) to generate for this scene"
                className="h-8 rounded-md border border-white/10 bg-white/5 px-1.5 text-[12px] text-foreground outline-none disabled:opacity-50"
                disabled={isRendering}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} take{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => renderScene(s)}
                disabled={isRendering}
                className="ad-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
              >
                {isRendering ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {isRendering
                  ? "Filming… (1-3 min)"
                  : `${s.variations.length ? "More takes" : "Generate"} · ~${sceneCredits({ duration: s.duration, takes: s.varCount ?? 2, engine: s.engine ?? model })} cr`}
              </button>
            </div>

            {s.variations.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {s.variations.map((v) => {
                  const isLocked = s.lockedAssetId === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`relative overflow-hidden rounded-lg border ${
                        isLocked ? "border-primary ring-2 ring-primary/40" : "border-border"
                      }`}
                    >
                      <video src={v.url} controls playsInline className="w-full bg-black" />
                      <button
                        type="button"
                        onClick={() => (isLocked ? unlock(s.id) : lock(s.id, v.id))}
                        className={`absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium backdrop-blur-sm ${
                          isLocked
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/85 text-foreground hover:bg-background"
                        }`}
                      >
                        {isLocked ? <Check className="size-3" /> : <Lock className="size-3" />}
                        {isLocked ? "Locked" : "Lock"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        <span className="text-[13px] text-muted-foreground">
          {lockedCount} of {scenes.length} scenes locked
        </span>
        <button
          type="button"
          onClick={stitch}
          disabled={stitching || lockedCount === 0}
          className="ad-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-50"
        >
          {stitching ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
          {stitching ? "Editing the film…" : "Stitch locked → film"}
        </button>
      </div>

      {finalUrl ? (
        <div className="rounded-2xl border border-primary/40 bg-card p-4">
          <div className="eyebrow mb-2">Final commercial</div>
          <video src={finalUrl} controls playsInline className="w-full rounded-lg bg-black" />
          <a
            href={finalUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            <Upload className="size-3.5 rotate-180" /> Download
          </a>
        </div>
      ) : null}
    </div>
  );
}
