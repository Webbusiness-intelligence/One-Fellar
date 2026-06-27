"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Heart, Copy, Download, Trash2, Check, X, Wand2, Maximize2, ImagePlus, Loader2, Frame, Scissors, LayoutGrid, Fingerprint, FileText } from "lucide-react";

const REFRAME_FORMATS = ["1:1", "4:5", "9:16", "16:9", "4:3", "3:4"];

export type ViewerItem = {
  id: string;
  url: string;
  label: string;
  scene?: string;
  favorite: boolean;
};

export function ActionIcon({
  onClick,
  title,
  active,
  danger,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex size-7 items-center justify-center rounded-md bg-background/85 backdrop-blur-sm transition-colors ${
        active
          ? "text-primary"
          : danger
            ? "text-muted-foreground hover:text-destructive"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function ResultCard({
  item,
  onOpen,
  onFavorite,
  onCopy,
  onDelete,
  onVariations,
  copied,
}: {
  item: ViewerItem;
  onOpen: (i: ViewerItem) => void;
  onFavorite: (i: ViewerItem) => void;
  onCopy: (i: ViewerItem) => void;
  onDelete: (i: ViewerItem) => void;
  onVariations?: (i: ViewerItem) => void;
  copied: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => onOpen(item)} className="block w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.label}
          className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </button>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onVariations && item.scene ? (
          <ActionIcon onClick={() => onVariations(item)} title="More like this">
            <Wand2 className="size-3.5" />
          </ActionIcon>
        ) : null}
        <ActionIcon
          onClick={() => onFavorite(item)}
          active={item.favorite}
          title={item.favorite ? "Unfavorite" : "Favorite"}
        >
          <Heart className={`size-3.5 ${item.favorite ? "fill-primary text-primary" : ""}`} />
        </ActionIcon>
        <ActionIcon onClick={() => onCopy(item)} title={copied ? "Copied" : "Copy prompt"}>
          {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
        </ActionIcon>
        <a
          href={item.url}
          download
          target="_blank"
          rel="noreferrer"
          title="Download"
          aria-label="Download"
          className="flex size-7 items-center justify-center rounded-md bg-background/85 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        >
          <Download className="size-3.5" />
        </a>
        <ActionIcon onClick={() => onDelete(item)} danger title="Delete">
          <Trash2 className="size-3.5" />
        </ActionIcon>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="truncate text-[13px] font-medium text-foreground" title={item.scene}>
          {item.label}
        </span>
        {item.favorite ? <Heart className="size-3.5 shrink-0 fill-primary text-primary" /> : null}
      </div>
    </div>
  );
}

export function Lightbox({
  item,
  onClose,
  onFavorite,
  onCopy,
  onDelete,
  onUpscale,
  onSetProduct,
  onReframe,
  onCutout,
  onSizePack,
  onSaveSoul,
  onSaveSkill,
  upscaling,
  reframing,
  exporting,
  savingSoul,
  savingSkill,
  copied,
}: {
  item: ViewerItem | null;
  onClose: () => void;
  onFavorite: (i: ViewerItem) => void;
  onCopy: (i: ViewerItem) => void;
  onDelete: (i: ViewerItem) => void;
  onUpscale?: (i: ViewerItem) => void;
  onSetProduct?: (i: ViewerItem) => void;
  onReframe?: (i: ViewerItem, format: string) => void;
  onCutout?: (i: ViewerItem) => void;
  onSizePack?: (i: ViewerItem) => void;
  onSaveSoul?: (i: ViewerItem, name: string, kind: string) => void;
  onSaveSkill?: (i: ViewerItem) => void;
  upscaling?: boolean;
  reframing?: boolean;
  exporting?: boolean;
  savingSoul?: boolean;
  savingSkill?: boolean;
  copied: boolean;
}) {
  const [showReframe, setShowReframe] = useState(false);
  const [showSoul, setShowSoul] = useState(false);
  const [soulName, setSoulName] = useState("");
  const [soulKind, setSoulKind] = useState("character");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const loadPrompt = async (id: string) => {
    setShowPrompt(true);
    setPromptLoading(true);
    try {
      const r = await fetch(`/api/ai-ads/assets/${id}/prompt`);
      const j = (await r.json()) as { prompt?: string };
      setPromptText(j.prompt || "(no prompt stored)");
    } catch {
      setPromptText("Couldn't load the prompt.");
    } finally {
      setPromptLoading(false);
    }
  };
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);
  if (!item) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[96vh] max-w-[96vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.label}
          className="max-h-[96vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
        />
        {upscaling ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-8 animate-spin text-white" />
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 space-y-2 rounded-b-lg bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-10">
          <p className="line-clamp-2 text-[12px] text-white/75">{item.scene || item.label}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionIcon
              onClick={() => onFavorite(item)}
              active={item.favorite}
              title={item.favorite ? "Unfavorite" : "Favorite"}
            >
              <Heart className={`size-4 ${item.favorite ? "fill-primary text-primary" : ""}`} />
            </ActionIcon>
            <ActionIcon onClick={() => onCopy(item)} title={copied ? "Copied" : "Copy prompt"}>
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </ActionIcon>
            <ActionIcon onClick={() => loadPrompt(item.id)} title="View the full prompt sent to the model">
              <FileText className="size-4" />
            </ActionIcon>
            {onUpscale ? (
              <ActionIcon
                onClick={() => onUpscale(item)}
                active={upscaling}
                title={upscaling ? "Upscaling…" : "Upscale to HD"}
              >
                {upscaling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </ActionIcon>
            ) : null}
            {onReframe ? (
              <div className="relative">
                <ActionIcon
                  onClick={() => setShowReframe((v) => !v)}
                  active={reframing || showReframe}
                  title={reframing ? "Reframing…" : "Reframe to another size"}
                >
                  {reframing ? <Loader2 className="size-4 animate-spin" /> : <Frame className="size-4" />}
                </ActionIcon>
                {showReframe ? (
                  <div className="absolute bottom-9 right-0 z-10 grid w-28 grid-cols-2 gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {REFRAME_FORMATS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setShowReframe(false);
                          onReframe(item, f);
                        }}
                        className="rounded px-2 py-1 text-center text-[12px] text-popover-foreground hover:bg-muted"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {onSetProduct ? (
              <ActionIcon onClick={() => onSetProduct(item)} title="Use as product image">
                <ImagePlus className="size-4" />
              </ActionIcon>
            ) : null}
            {onSaveSoul ? (
              <div className="relative">
                <ActionIcon
                  onClick={() => setShowSoul((v) => !v)}
                  active={showSoul || savingSoul}
                  title={savingSoul ? "Saving…" : "Save as Soul ID"}
                >
                  {savingSoul ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
                </ActionIcon>
                {showSoul ? (
                  <div
                    className="absolute bottom-9 right-0 z-10 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      value={soulName}
                      onChange={(e) => setSoulName(e.target.value)}
                      placeholder="Name (e.g. Aurora founder)"
                      className="mb-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
                    />
                    <select
                      value={soulKind}
                      onChange={(e) => setSoulKind(e.target.value)}
                      className="mb-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none"
                    >
                      <option value="character">Character</option>
                      <option value="product">Product</option>
                      <option value="location">Location</option>
                      <option value="prop">Prop</option>
                      <option value="style">Style</option>
                    </select>
                    <button
                      type="button"
                      disabled={!soulName.trim() || savingSoul}
                      onClick={() => {
                        onSaveSoul(item, soulName.trim(), soulKind);
                        setShowSoul(false);
                        setSoulName("");
                      }}
                      className="ad-cta flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-medium disabled:opacity-50"
                    >
                      <Fingerprint className="size-3.5" /> Save Soul ID
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {onSaveSkill ? (
              <ActionIcon
                onClick={() => onSaveSkill(item)}
                active={savingSkill}
                title={savingSkill ? "Saving skill…" : "Save the look as a Skill"}
              >
                {savingSkill ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              </ActionIcon>
            ) : null}
            {onSizePack ? (
              <ActionIcon onClick={() => onSizePack(item)} active={exporting} title="Size pack — 1:1, 9:16, 16:9">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <LayoutGrid className="size-4" />}
              </ActionIcon>
            ) : null}
            {onCutout ? (
              <ActionIcon
                onClick={() => onCutout(item)}
                active={exporting}
                title="Transparent PNG (remove background)"
              >
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />}
              </ActionIcon>
            ) : null}
            <a
              href={item.url}
              download
              target="_blank"
              rel="noreferrer"
              title="Download"
              aria-label="Download"
              className="flex size-7 items-center justify-center rounded-md bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="size-4" />
            </a>
            <ActionIcon onClick={() => onDelete(item)} danger title="Delete">
              <Trash2 className="size-4" />
            </ActionIcon>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-background/85 text-muted-foreground backdrop-blur-sm hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        {showPrompt ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={(e) => {
              e.stopPropagation();
              setShowPrompt(false);
            }}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileText className="size-4 text-primary" /> Full prompt sent to the model
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPrompt(false)}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              {promptLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" /> Loading…
                </div>
              ) : (
                <>
                  <textarea
                    readOnly
                    value={promptText}
                    rows={14}
                    className="w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(promptText)}
                    className="mt-2 flex items-center gap-1.5 self-end rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground/80 hover:text-foreground"
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
