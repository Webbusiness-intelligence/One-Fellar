"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, Sparkles, X, Plus, RefreshCw } from "lucide-react";

import { Lightbox, type ViewerItem } from "../ad-result";
import { posterCredits } from "@/lib/ai-ads/cost";

export type PosterProduct = { id: string; name: string; imageUrl: string | null };
type Asset = { id: string; url: string; label: string; favorite: boolean };

const STYLES = [
  { v: "luxury-editorial", label: "Luxury editorial" },
  { v: "swiss", label: "Swiss minimal" },
  { v: "art-deco", label: "Art Deco" },
  { v: "cinematic", label: "Cinematic" },
  { v: "tech-minimal", label: "Tech minimal" },
  { v: "organic", label: "Organic" },
  { v: "brutalist", label: "Bold brutalist" },
  { v: "streetwear", label: "Streetwear" },
  { v: "vintage", label: "Vintage" },
  { v: "maximalist", label: "Maximalist" },
];
const FORMATS = [
  { v: "4:5", label: "Portrait · 4:5" },
  { v: "9:16", label: "Story · 9:16" },
  { v: "1:1", label: "Square · 1:1" },
  { v: "3:4", label: "Portrait · 3:4" },
  { v: "16:9", label: "Wide · 16:9" },
  { v: "2:3", label: "Photo · 2:3" },
];
const ASPECT: Record<string, string> = {
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "3:4": "aspect-[3/4]",
  "16:9": "aspect-[16/9]",
  "2:3": "aspect-[2/3]",
};
const LENSES = [
  { v: "", label: "Lens · Auto" },
  { v: "shot on an 85mm f/1.4 lens, shallow depth of field, creamy bokeh", label: "85mm portrait" },
  { v: "shot on a 50mm lens, natural perspective", label: "50mm" },
  { v: "shot on a 35mm lens, environmental", label: "35mm" },
  { v: "shot on a 100mm macro lens, extreme detail", label: "Macro" },
  { v: "shot with a wide-angle lens, dramatic perspective", label: "Wide" },
];
const ANGLES = [
  { v: "", label: "Angle · Auto" },
  { v: "dramatic low hero angle looking up", label: "Low / hero" },
  { v: "eye-level three-quarter angle", label: "Eye-level" },
  { v: "overhead top-down flat-lay", label: "Overhead" },
  { v: "extreme macro close-up", label: "Macro close-up" },
  { v: "dynamic dutch-tilt angle", label: "Dutch tilt" },
];
const LIGHTS = [
  { v: "", label: "Light · Auto" },
  { v: "soft studio softbox lighting", label: "Studio softbox" },
  { v: "dramatic Rembrandt lighting with deep shadows", label: "Rembrandt" },
  { v: "rim / back lighting for glowing separation", label: "Rim / backlit" },
  { v: "warm golden-hour light", label: "Golden hour" },
  { v: "moody low-key chiaroscuro lighting", label: "Low-key" },
  { v: "bright airy high-key lighting", label: "High-key" },
  { v: "vibrant neon coloured-gel lighting", label: "Neon" },
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function PosterClient({ products }: { products: PosterProduct[] }) {
  const [headline, setHeadline] = useState("");
  const [subline, setSubline] = useState("");
  const [cta, setCta] = useState("");
  const [details, setDetails] = useState("");
  const [productId, setProductId] = useState<string | null>(products[0]?.id ?? null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [useLogo, setUseLogo] = useState(false);
  const [style, setStyle] = useState("luxury-editorial");
  const [format, setFormat] = useState("4:5");
  const [count, setCount] = useState(1);
  const [quality, setQuality] = useState<"standard" | "hd" | "best">("best");
  const [lens, setLens] = useState("");
  const [angle, setAngle] = useState("");
  const [lighting, setLighting] = useState("");
  const [backdrop, setBackdrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);
  const prodInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  async function generate() {
    if (!headline.trim() && !subline.trim() && !cta.trim()) {
      setError("Add at least a headline or some copy.");
      return;
    }
    setLoading(true);
    setError(null);
    setAssets([]);
    try {
      const fd = new FormData();
      fd.set("headline", headline);
      fd.set("subline", subline);
      fd.set("cta", cta);
      fd.set("details", details);
      fd.set("style", style);
      fd.set("format", format);
      fd.set("count", String(count));
      fd.set("quality", quality);
      if (productFile) fd.set("product", productFile);
      else if (productId) fd.set("productId", productId);
      if (logoFile) fd.set("logo", logoFile);
      if (!useLogo) fd.set("noLogo", "1");
      const directives = [lens, angle, lighting].filter(Boolean).join("; ");
      if (directives) fd.set("directives", directives);
      if (backdrop) fd.set("backdrop", "1");
      const r = await fetch("/api/ai-ads/poster", { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Failed");
      const j = (await r.json()) as { assets: Asset[] };
      setAssets(j.assets ?? []);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }

  function patch(id: string, p: Partial<Asset>) {
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setViewer((v) => (v && v.id === id ? { ...v, ...p } : v));
  }
  async function toggleFavorite(item: ViewerItem) {
    const fav = !item.favorite;
    patch(item.id, { favorite: fav });
    fetch(`/api/ai-ads/assets/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: fav }),
    }).catch(() => {});
  }
  async function deleteAsset(item: ViewerItem) {
    setAssets((a) => a.filter((x) => x.id !== item.id));
    setViewer(null);
    fetch(`/api/ai-ads/assets/${item.id}`, { method: "DELETE" }).catch(() => {});
  }
  async function upscale(item: ViewerItem) {
    setUpscalingId(item.id);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/upscale`, { method: "POST" });
      if (!r.ok) throw new Error("Upscale failed");
      patch(item.id, { url: ((await r.json()) as { url: string }).url });
    } catch (e) {
      setError(msg(e));
    } finally {
      setUpscalingId(null);
    }
  }

  const productThumb = productFile
    ? URL.createObjectURL(productFile)
    : products.find((p) => p.id === productId)?.imageUrl ?? null;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[380px_1fr]">
      {/* Form */}
      <div className="space-y-4">
        <div>
          <div className="text-lg font-semibold text-foreground">Poster studio</div>
          <p className="text-sm text-muted-foreground">
            Give it your copy, product and logo — it designs a premium poster.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline *" className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary" />
          <input value={subline} onChange={(e) => setSubline(e.target.value)} placeholder="Subheadline" className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary" />
          <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Offer / CTA (e.g. 30% OFF · Shop now)" className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-primary" />
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Any extra details (dates, location, fine print)…" className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>

        {/* Product */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="eyebrow mb-2">Product</div>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id);
                  setProductFile(null);
                }}
                title={p.name}
                className={`size-16 overflow-hidden rounded-lg border ${
                  !productFile && productId === p.id ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">{p.name}</span>
                )}
              </button>
            ))}
            <input ref={prodInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProductFile(f); setProductId(null); } e.target.value = ""; }} />
            <button
              type="button"
              onClick={() => prodInput.current?.click()}
              className={`flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed ${productFile ? "border-primary ring-2 ring-primary/30" : "border-border"} text-muted-foreground hover:text-foreground`}
            >
              {productFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(productFile)} alt="upload" className="size-full rounded-lg object-cover" />
              ) : (
                <>
                  <Plus className="size-4" />
                  <span className="text-[9px]">Upload</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setProductId(null);
                setProductFile(null);
              }}
              className={`flex size-16 items-center justify-center rounded-lg border text-[11px] ${!productFile && !productId ? "border-primary text-primary ring-2 ring-primary/30" : "border-border text-muted-foreground"}`}
            >
              None
            </button>
          </div>
        </div>

        {/* Logo + style + format */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} />
              Include logo
            </label>
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setUseLogo(true); } e.target.value = ""; }} />
            <button type="button" onClick={() => logoInput.current?.click()} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
              <Upload className="size-3.5" /> {logoFile ? "Logo ready" : "Upload logo"}
            </button>
          </div>

          <div>
            <div className="eyebrow mb-1.5">Style</div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setStyle(s.v)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                    style === s.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="eyebrow mb-1.5">Size</div>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary">
                {FORMATS.map((f) => (
                  <option key={f.v} value={f.v}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Count</div>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary">
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Quality</div>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as "standard" | "hd" | "best")}
                title="Higher quality is sharper and costs more"
                className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[13px] text-foreground outline-none focus:border-primary"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD</option>
                <option value="best">Best</option>
              </select>
            </div>
          </div>
        </div>

        {/* Camera & light */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="eyebrow">Camera &amp; light</div>
          <div className="grid grid-cols-3 gap-2">
            <select value={lens} onChange={(e) => setLens(e.target.value)} className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none focus:border-primary">
              {LENSES.map((o) => (
                <option key={o.label} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={angle} onChange={(e) => setAngle(e.target.value)} className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none focus:border-primary">
              {ANGLES.map((o) => (
                <option key={o.label} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={lighting} onChange={(e) => setLighting(e.target.value)} className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-foreground outline-none focus:border-primary">
              {LIGHTS.map((o) => (
                <option key={o.label} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={backdrop} onChange={(e) => setBackdrop(e.target.checked)} />
            Cinematic backdrop
            <span className="text-[11px] text-muted-foreground">2-stage · slower, max premium</span>
          </label>
        </div>

        {error ? <p className="px-1 text-[12px] text-destructive">{error}</p> : null}

        <button type="button" onClick={generate} disabled={loading} className="ad-cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium disabled:opacity-60">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" strokeWidth={2} />}
          {loading
            ? "Designing your poster…"
            : `Generate poster · ${posterCredits({ count, backdrop, quality })} credits`}
        </button>
      </div>

      {/* Results */}
      <div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="ad-grad-border rounded-xl p-px">
                <div className={`relative w-full ${ASPECT[format]} overflow-hidden rounded-[11px] bg-card`}>
                  <div className="ad-shimmer absolute inset-0" />
                </div>
              </div>
            ))}
          </div>
        ) : assets.length ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="eyebrow">Your posters</div>
              <button type="button" onClick={generate} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                <RefreshCw className="size-3.5" /> Regenerate
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setViewer({ id: a.id, url: a.url, label: a.label, favorite: a.favorite })}
                  className="group overflow-hidden rounded-xl border border-border bg-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.label} className="w-full transition-transform duration-500 group-hover:scale-[1.02]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="size-6 text-primary" strokeWidth={2} />
            </div>
            <p className="text-sm font-medium text-foreground">Your poster appears here</p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
              {productThumb ? "Product ready." : "Pick a product (optional)."} Add your copy and hit generate.
            </p>
          </div>
        )}
      </div>

      <Lightbox
        item={viewer}
        onClose={() => setViewer(null)}
        onFavorite={toggleFavorite}
        onCopy={() => {}}
        onDelete={deleteAsset}
        onUpscale={upscale}
        upscaling={!!viewer && upscalingId === viewer.id}
        copied={false}
      />
    </div>
  );
}
