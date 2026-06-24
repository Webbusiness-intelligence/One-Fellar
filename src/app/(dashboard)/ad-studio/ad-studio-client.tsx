"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  Loader2,
  Check,
  Images,
  X,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultCard, Lightbox, type ViewerItem } from "./ad-result";
import { quickCredits } from "@/lib/ai-ads/cost";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Product = { id: string; name: string; description: string | null; imageUrl: string | null };
type Asset = { id: string; url: string; label: string; scene: string; favorite: boolean };
type CompareResult = {
  id?: string;
  model: string;
  label: string;
  url: string | null;
  favorite?: boolean;
};

const FORMATS = [
  { id: "all", label: "All sizes (1:1 · 9:16 · 16:9)" },
  { id: "1:1", label: "Square · 1:1" },
  { id: "4:5", label: "Portrait · 4:5" },
  { id: "9:16", label: "Story · 9:16" },
  { id: "16:9", label: "Wide · 16:9" },
  { id: "4:3", label: "Landscape · 4:3" },
  { id: "3:4", label: "Portrait tall · 3:4" },
  { id: "3:2", label: "Photo · 3:2" },
  { id: "2:3", label: "Photo tall · 2:3" },
  { id: "21:9", label: "Cinematic · 21:9" },
] as const;
const ASPECT: Record<string, string> = {
  all: "aspect-square",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
  "4:3": "aspect-[4/3]",
  "3:4": "aspect-[3/4]",
  "3:2": "aspect-[3/2]",
  "2:3": "aspect-[2/3]",
  "21:9": "aspect-[21/9]",
};

const STYLES = [
  { id: "minimal", label: "Minimal", text: "minimalist, clean composition, lots of negative space" },
  { id: "editorial", label: "Editorial", text: "high-fashion editorial, magazine-quality lighting" },
  { id: "vintage", label: "Vintage film", text: "vintage 35mm film look, warm grain, nostalgic" },
  { id: "neon", label: "Neon", text: "vibrant neon glow, moody cyberpunk lighting" },
  { id: "studio", label: "Studio", text: "clean studio product photography, seamless backdrop" },
  { id: "outdoor", label: "Outdoor", text: "natural outdoor setting, golden-hour daylight" },
  { id: "luxury", label: "Luxury", text: "luxury, premium materials, elegant and aspirational" },
] as const;

const MODELS = [
  { id: "seedream", name: "Seedream 4", tag: "best look" },
  { id: "nano-banana", name: "Nano Banana", tag: "premium realism" },
  { id: "flux-kontext", name: "FLUX Kontext", tag: "pro editing" },
  { id: "gpt-image", name: "GPT Image", tag: "best text & logos" },
  { id: "bria", name: "Bria", tag: "exact fidelity, commercial-safe" },
  { id: "locked", name: "Locked", tag: "exact product, real pixels" },
  { id: "compare", name: "Compare models", tag: "side-by-side" },
] as const;

const COMPARE_IDS = ["seedream", "nano-banana", "bria"];

const SUGGESTIONS = [
  "luxury & minimal, soft daylight",
  "outdoor lifestyle, golden hour",
  "studio on marble, dramatic shadows",
  "vibrant colour pop, bold",
  "cozy home, warm tones",
];

const STEPS = [
  "Reading your product",
  "Directing the scene",
  "Composing the shot",
  "Compositing your product",
  "Adding final polish",
];

function CyclingStatus() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => Math.min(p + 1, STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      <span className="ad-grad-text font-medium">{STEPS[i]}…</span>
    </div>
  );
}

function SkeletonTile({ aspect, label }: { aspect: string; label?: string }) {
  return (
    <div className="ad-grad-border rounded-xl p-px">
      <div className={`relative w-full ${aspect} overflow-hidden rounded-[11px] bg-card`}>
        <div className="ad-shimmer absolute inset-0" />
        {label ? (
          <div className="absolute bottom-2 left-2 rounded-md bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdStudioClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selected, setSelected] = useState<Product | null>(initialProducts[0] ?? null);

  const [showAdd, setShowAdd] = useState(initialProducts.length === 0);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<string>("1:1");
  const [model, setModel] = useState<(typeof MODELS)[number]["id"]>("seedream");
  const [count, setCount] = useState(3);
  const [style, setStyle] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<Product | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);

  const [photosTarget, setPhotosTarget] = useState<Product | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; isPrimary: boolean }[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
  const aspect = ASPECT[format];

  async function loadProducts(): Promise<Product[]> {
    const r = await fetch("/api/ai-ads/products");
    if (!r.ok) return products;
    const j = (await r.json()) as { products: Product[] };
    setProducts(j.products);
    return j.products;
  }

  async function importFromUrl() {
    if (!url.trim()) {
      setError("Paste a product URL.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const r = await fetch("/api/ai-ads/products/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Import failed");
      const { id } = (await r.json()) as { id: string };
      setUrl("");
      setShowAdd(false);
      const list = await loadProducts();
      setSelected(list.find((p) => p.id === id) ?? list[0] ?? null);
      setAssets([]);
      setCompareResults([]);
    } catch (e) {
      setError(msg(e));
    } finally {
      setImporting(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError("Add a name and a product image.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("image", file);
      const r = await fetch("/api/ai-ads/products", { method: "POST", body: fd });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Upload failed");
      const { id } = (await r.json()) as { id: string };
      setName("");
      setFile(null);
      setShowAdd(false);
      const list = await loadProducts();
      setSelected(list.find((p) => p.id === id) ?? list[0] ?? null);
      setAssets([]);
      setCompareResults([]);
    } catch (e) {
      setError(msg(e));
    } finally {
      setCreating(false);
    }
  }

  async function run() {
    if (!selected || !prompt.trim()) {
      setError("Pick a product and describe the ad.");
      return;
    }
    setLoading(true);
    setError(null);
    setAssets([]);
    setCompareResults([]);
    try {
      const styleText = STYLES.find((s) => s.id === style)?.text;
      const fullPrompt = [styleText, prompt.trim()].filter(Boolean).join(", ");
      if (model === "compare") {
        const r = await fetch("/api/ai-ads/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: selected.id,
            prompt: fullPrompt,
            format: format === "all" ? "1:1" : format,
          }),
        });
        if (!r.ok)
          throw new Error(((await r.json()) as { error?: string }).error ?? "Comparison failed");
        const j = (await r.json()) as { results: CompareResult[] };
        setCompareResults(j.results);
      } else {
        const isAll = format === "all";
        const r = await fetch("/api/ai-ads/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: selected.id,
            prompt: fullPrompt,
            format: isAll ? "1:1" : format,
            model,
            count,
            ...(isAll ? { formats: ["1:1", "9:16", "16:9"] } : {}),
          }),
        });
        if (!r.ok)
          throw new Error(((await r.json()) as { error?: string }).error ?? "Generation failed");
        const j = (await r.json()) as { assets: Asset[] };
        setAssets(j.assets);
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveRename() {
    if (!renameTarget || !renameName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/ai-ads/products/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Rename failed");
      setRenameTarget(null);
      const list = await loadProducts();
      setSelected((s) => (s ? (list.find((p) => p.id === s.id) ?? s) : s));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    const wasSelected = selected?.id === deleteTarget.id;
    try {
      const r = await fetch(`/api/ai-ads/products/${deleteTarget.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Delete failed");
      setDeleteTarget(null);
      const list = await loadProducts();
      if (wasSelected) {
        setSelected(list[0] ?? null);
        setAssets([]);
        setCompareResults([]);
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function openPhotos(p: Product) {
    setPhotosTarget(p);
    setPhotos([]);
    setPhotosLoading(true);
    try {
      const r = await fetch(`/api/ai-ads/products/${p.id}/images`);
      if (r.ok) setPhotos(((await r.json()) as { images: typeof photos }).images);
    } finally {
      setPhotosLoading(false);
    }
  }

  async function refreshPhotos(productId: string) {
    const r = await fetch(`/api/ai-ads/products/${productId}/images`);
    if (r.ok) setPhotos(((await r.json()) as { images: typeof photos }).images);
    const list = await loadProducts();
    setSelected((s) => (s ? (list.find((p) => p.id === s.id) ?? s) : s));
  }

  async function addPhoto(file: File | null) {
    if (!photosTarget || !file) return;
    setAddingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const r = await fetch(`/api/ai-ads/products/${photosTarget.id}/images`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Upload failed");
      await refreshPhotos(photosTarget.id);
    } catch (e) {
      setError(msg(e));
    } finally {
      setAddingPhoto(false);
    }
  }

  async function setPrimaryPhoto(imageId: string) {
    if (!photosTarget) return;
    await fetch(`/api/ai-ads/product-images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary: true }),
    });
    await refreshPhotos(photosTarget.id);
  }

  async function deletePhoto(imageId: string) {
    if (!photosTarget) return;
    await fetch(`/api/ai-ads/product-images/${imageId}`, { method: "DELETE" });
    await refreshPhotos(photosTarget.id);
  }

  async function makeVariations(item: ViewerItem) {
    if (!selected || !item.scene) return;
    const useModel = model === "compare" ? "seedream" : model;
    setViewer(null);
    setLoading(true);
    setError(null);
    setAssets([]);
    setCompareResults([]);
    try {
      const r = await fetch("/api/ai-ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          prompt: prompt.trim() || item.label,
          format: format === "all" ? "1:1" : format,
          model: useModel,
          count,
          scene: item.scene,
        }),
      });
      if (!r.ok)
        throw new Error(((await r.json()) as { error?: string }).error ?? "Generation failed");
      const j = (await r.json()) as { assets: Asset[] };
      setAssets(j.assets);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(item: ViewerItem) {
    const fav = !item.favorite;
    setAssets((a) => a.map((x) => (x.id === item.id ? { ...x, favorite: fav } : x)));
    setCompareResults((c) => c.map((x) => (x.id === item.id ? { ...x, favorite: fav } : x)));
    setViewer((v) => (v && v.id === item.id ? { ...v, favorite: fav } : v));
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: fav }),
      });
    } catch {
      /* keep optimistic state */
    }
  }

  async function deleteAsset(item: ViewerItem) {
    setAssets((a) => a.filter((x) => x.id !== item.id));
    setCompareResults((c) => c.filter((x) => x.id !== item.id));
    setViewer((v) => (v && v.id === item.id ? null : v));
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, { method: "DELETE" });
    } catch {
      /* already removed locally */
    }
  }

  function copyScene(item: ViewerItem) {
    navigator.clipboard?.writeText(item.scene || prompt || "");
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1200);
  }

  async function upscale(item: ViewerItem) {
    setUpscalingId(item.id);
    setError(null);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/upscale`, { method: "POST" });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Upscale failed");
      const { url } = (await r.json()) as { url: string };
      setAssets((a) => a.map((x) => (x.id === item.id ? { ...x, url } : x)));
      setCompareResults((c) => c.map((x) => (x.id === item.id ? { ...x, url } : x)));
      setViewer((v) => (v && v.id === item.id ? { ...v, url } : v));
    } catch (e) {
      setError(msg(e));
    } finally {
      setUpscalingId(null);
    }
  }

  async function setAsProduct(item: ViewerItem) {
    setError(null);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/set-product`, { method: "POST" });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Failed");
      const list = await loadProducts();
      setSelected((s) => (s ? (list.find((p) => p.id === s.id) ?? s) : s));
      setViewer(null);
    } catch (e) {
      setError(msg(e));
    }
  }

  const skeletonCount = model === "compare" || format === "all" ? 3 : count;
  const skeletonLabels =
    model === "compare" ? MODELS.filter((m) => COMPARE_IDS.includes(m.id)).map((m) => m.name) : [];

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Sparkles className="size-5 text-primary" strokeWidth={1.75} />
            Ad Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe the ad. We direct the scene and place your product in — kept exactly intact.
          </p>
        </div>
        <Link
          href="/ad-studio/gallery"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Images className="size-4" strokeWidth={1.75} />
          Gallery
        </Link>
      </div>

      {/* Products */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="eyebrow">Your products</div>
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            {showAdd ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showAdd ? "Close" : "New product"}
          </button>
        </div>

        {showAdd && (
          <form
            onSubmit={createProduct}
            className="ad-reveal mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Product name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aurora Perfume"
                className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Product photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add product"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">or</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a product URL…"
                className="h-9 w-60 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
              <Button type="button" variant="outline" onClick={importFromUrl} disabled={importing}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </form>
        )}

        {products.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {products.map((p) => {
              const active = selected?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`group relative w-28 shrink-0 overflow-hidden rounded-xl border transition-all ${
                    active
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setAssets([]);
                      setCompareResults([]);
                    }}
                    className="block w-full text-left"
                  >
                    <div className="aspect-square bg-muted">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="truncate px-2 py-1.5 pr-7 text-[12px] font-medium text-foreground">
                      {p.name}
                    </div>
                  </button>
                  {active && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Product actions"
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md bg-background/70 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus:outline-none data-popup-open:bg-background"
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36 bg-popover">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(p);
                          setRenameName(p.name);
                        }}
                      >
                        <Pencil className="size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openPhotos(p)}>
                        <Images className="size-4" />
                        Manage photos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(p)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          !showAdd && (
            <p className="text-sm text-muted-foreground">
              No products yet — add one to start generating ads.
            </p>
          )
        )}
      </div>

      {/* Composer */}
      {selected && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="size-9 overflow-hidden rounded-lg bg-muted">
              {selected.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="eyebrow">Creating ads for</div>
              <div className="truncate text-sm font-medium text-foreground">{selected.name}</div>
            </div>
          </div>

          <div className="p-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe the ad — vibe, setting, audience… e.g. ‘luxury, warm morning light, marble bathroom, aspirational’"
              className="w-full resize-none rounded-xl border border-input bg-background p-3.5 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15"
            />

            {/* Suggestions */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt((p) => (p.trim() ? `${p.trim()}, ${s}` : s))}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <div className="eyebrow mb-1.5">Style</div>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle((v) => (v === s.id ? null : s.id))}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                      style === s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="eyebrow mb-1.5">Format</div>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                  >
                    {FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="eyebrow mb-1.5">Model</div>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as (typeof MODELS)[number]["id"])}
                    className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                  >
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.tag}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="eyebrow mb-1.5">Variations</div>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={run}
                disabled={loading}
                className="ad-cta inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-medium disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" strokeWidth={2} />
                )}
                {loading
                  ? "Generating…"
                  : `${model === "compare" ? "Compare models" : "Generate ads"} · ${quickCredits({
                      count,
                      model,
                      allSizes: format === "all",
                    })} credits`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Generation in progress */}
      {loading && (
        <div className="mt-6">
          <div className="mb-3">
            <CyclingStatus />
          </div>
          <div
            className={`grid gap-4 ${
              model === "compare" ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonTile key={i} aspect={aspect} label={skeletonLabels[i]} />
            ))}
          </div>
        </div>
      )}

      {/* Results — single model */}
      {!loading && assets.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="eyebrow">Generated ads</div>
            <button
              type="button"
              onClick={() => run()}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              <RefreshCw className="size-3.5" />
              Regenerate
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a, i) => (
              <div key={a.id || i} className="ad-reveal" style={{ animationDelay: `${i * 90}ms` }}>
                <ResultCard
                  item={{ id: a.id, url: a.url, label: a.label, scene: a.scene, favorite: a.favorite }}
                  onOpen={setViewer}
                  onFavorite={toggleFavorite}
                  onCopy={copyScene}
                  onDelete={deleteAsset}
                  onVariations={makeVariations}
                  copied={copiedId === a.id}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results — model comparison */}
      {!loading && compareResults.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="eyebrow">Model comparison · same product &amp; scene</div>
            <button
              type="button"
              onClick={() => run()}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              <RefreshCw className="size-3.5" />
              Regenerate
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {compareResults.map((r, i) => (
              <div key={r.model} className="ad-reveal" style={{ animationDelay: `${i * 90}ms` }}>
                {r.url && r.id ? (
                  <ResultCard
                    item={{ id: r.id, url: r.url, label: r.label, favorite: !!r.favorite }}
                    onOpen={setViewer}
                    onFavorite={toggleFavorite}
                    onCopy={copyScene}
                    onDelete={deleteAsset}
                    copied={copiedId === r.id}
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex aspect-square items-center justify-center bg-muted text-sm text-muted-foreground">
                      Failed
                    </div>
                    <div className="px-3 py-2 text-[13px] font-medium text-foreground">{r.label}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty hint after first load */}
      {!loading && assets.length === 0 && compareResults.length === 0 && selected && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="ad-grad-border mb-3 rounded-2xl p-px">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-card">
              <Sparkles className="size-5 text-primary" strokeWidth={1.75} />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Your ads will appear here</p>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            Write a prompt above and hit generate — variations stream in as they finish.
          </p>
        </div>
      )}

      {/* Rename product */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename product</DialogTitle>
          </DialogHeader>
          <input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            autoFocus
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveRename} disabled={busy || !renameName.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete product confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{deleteTarget?.name}” and every ad generated from it. This
              can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage product photos */}
      <Dialog open={!!photosTarget} onOpenChange={(o) => !o && setPhotosTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Photos · {photosTarget?.name}</DialogTitle>
            <DialogDescription>
              Up to 5. The starred photo is used to generate ads.
            </DialogDescription>
          </DialogHeader>
          {photosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((im) => (
                <div
                  key={im.id}
                  className={`group relative overflow-hidden rounded-lg border ${
                    im.isPrimary ? "border-primary ring-2 ring-primary/25" : "border-border"
                  }`}
                >
                  <div className="aspect-square bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  {im.isPrimary ? (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Primary
                    </span>
                  ) : null}
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!im.isPrimary ? (
                      <button
                        type="button"
                        onClick={() => setPrimaryPhoto(im.id)}
                        title="Set as primary"
                        aria-label="Set as primary"
                        className="flex size-6 items-center justify-center rounded bg-background/85 text-muted-foreground backdrop-blur-sm hover:text-primary"
                      >
                        <Star className="size-3.5" />
                      </button>
                    ) : null}
                    {photos.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => deletePhoto(im.id)}
                        title="Delete photo"
                        aria-label="Delete photo"
                        className="flex size-6 items-center justify-center rounded bg-background/85 text-muted-foreground backdrop-blur-sm hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {photos.length < 5 ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {addingPhoto ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                  <span className="text-[11px]">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={addingPhoto}
                    onChange={(e) => addPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotosTarget(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Lightbox
        item={viewer}
        onClose={() => setViewer(null)}
        onFavorite={toggleFavorite}
        onCopy={copyScene}
        onDelete={deleteAsset}
        onUpscale={upscale}
        onSetProduct={setAsProduct}
        upscaling={!!viewer && upscalingId === viewer.id}
        copied={!!viewer && copiedId === viewer.id}
      />
    </div>
  );
}
