"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Heart, Download, Loader2 } from "lucide-react";

import { ResultCard, Lightbox, type ViewerItem } from "../ad-result";

type Item = ViewerItem & { model?: string };

export function GalleryClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);
  const [reframingId, setReframingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const shown = useMemo(
    () => (filter === "favorites" ? items.filter((i) => i.favorite) : items),
    [items, filter],
  );
  const favCount = items.filter((i) => i.favorite).length;

  async function toggleFavorite(item: ViewerItem) {
    const fav = !item.favorite;
    setItems((a) => a.map((x) => (x.id === item.id ? { ...x, favorite: fav } : x)));
    setViewer((v) => (v && v.id === item.id ? { ...v, favorite: fav } : v));
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: fav }),
      });
    } catch {
      /* keep optimistic */
    }
  }

  async function deleteAsset(item: ViewerItem) {
    setItems((a) => a.filter((x) => x.id !== item.id));
    setViewer((v) => (v && v.id === item.id ? null : v));
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, { method: "DELETE" });
    } catch {
      /* already removed locally */
    }
  }

  function copyScene(item: ViewerItem) {
    navigator.clipboard?.writeText(item.scene || item.label || "");
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1200);
  }

  async function upscale(item: ViewerItem) {
    setUpscalingId(item.id);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/upscale`, { method: "POST" });
      if (!r.ok) return;
      const { url } = (await r.json()) as { url: string };
      setItems((a) => a.map((x) => (x.id === item.id ? { ...x, url } : x)));
      setViewer((v) => (v && v.id === item.id ? { ...v, url } : v));
    } finally {
      setUpscalingId(null);
    }
  }

  async function reframe(item: ViewerItem, format: string) {
    setReframingId(item.id);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/reframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!r.ok) return;
      const a = (await r.json()) as Item;
      setItems((cur) => [a, ...cur]);
      setViewer(a);
    } finally {
      setReframingId(null);
    }
  }

  async function cutout(item: ViewerItem) {
    setExportingId(item.id);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/cutout`, { method: "POST" });
      if (!r.ok) return;
      const a = (await r.json()) as Item;
      setItems((cur) => [a, ...cur]);
      setViewer(a);
    } finally {
      setExportingId(null);
    }
  }

  async function sizePack(item: ViewerItem) {
    setExportingId(item.id);
    try {
      const formats = ["1:1", "9:16", "16:9"];
      const results = await Promise.all(
        formats.map((f) =>
          fetch(`/api/ai-ads/assets/${item.id}/reframe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format: f }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      const made = results.filter(Boolean) as Item[];
      if (made.length) setItems((cur) => [...made, ...cur]);
    } finally {
      setExportingId(null);
    }
  }

  async function downloadAll() {
    setDownloadingAll(true);
    try {
      for (const it of shown.slice(0, 30)) {
        try {
          const blob = await (await fetch(it.url)).blob();
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u;
          a.download = `${(it.label || "ad").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(u);
          await new Promise((r) => setTimeout(r, 350));
        } catch {
          /* skip one */
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Sparkles className="size-5 text-primary" strokeWidth={1.75} />
            Gallery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Every ad you’ve generated.</p>
        </div>
        <div className="flex items-center gap-2">
          {shown.length > 0 ? (
            <button
              type="button"
              onClick={downloadAll}
              disabled={downloadingAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {downloadingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" strokeWidth={1.75} />
              )}
              Download all
            </button>
          ) : null}
          <Link
            href="/ad-studio"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back to studio
          </Link>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-md border px-3 py-1 text-[13px] transition-colors ${
            filter === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All <span className="opacity-60">{items.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("favorites")}
          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-[13px] transition-colors ${
            filter === "favorites"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`size-3.5 ${filter === "favorites" ? "fill-primary" : ""}`} />
          Favorites <span className="opacity-60">{favCount}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">
            {filter === "favorites" ? "No favorites yet" : "No ads yet"}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {filter === "favorites"
              ? "Tap the heart on an ad to save it here."
              : "Generate your first ad in the studio."}
          </p>
          <Link
            href="/ad-studio"
            className="ad-cta mt-4 inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium"
          >
            <Sparkles className="size-4" strokeWidth={2} />
            Go to studio
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((it, i) => (
            <div key={it.id} className="ad-reveal" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <ResultCard
                item={it}
                onOpen={setViewer}
                onFavorite={toggleFavorite}
                onCopy={copyScene}
                onDelete={deleteAsset}
                copied={copiedId === it.id}
              />
            </div>
          ))}
        </div>
      )}

      <Lightbox
        item={viewer}
        onClose={() => setViewer(null)}
        onFavorite={toggleFavorite}
        onCopy={copyScene}
        onDelete={deleteAsset}
        onUpscale={upscale}
        onReframe={reframe}
        onCutout={cutout}
        onSizePack={sizePack}
        upscaling={!!viewer && upscalingId === viewer.id}
        reframing={!!viewer && reframingId === viewer.id}
        exporting={!!viewer && exportingId === viewer.id}
        copied={!!viewer && copiedId === viewer.id}
      />
    </div>
  );
}
