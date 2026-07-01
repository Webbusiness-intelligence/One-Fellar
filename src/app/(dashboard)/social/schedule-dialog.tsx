"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Send, X } from "lucide-react";

import { cn } from "@/lib/utils";

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Reusable "share to social" dialog — used from the planner, the gallery viewer,
 * and the generation result. Pass `initialUrl` to prefill the media.
 */
export function ScheduleDialog({
  open,
  onClose,
  initialUrl,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  onDone?: () => void;
}) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [assets, setAssets] = useState<{ id: string; url: string }[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [picker, setPicker] = useState(false);
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setMediaUrl(initialUrl ?? "");
    setPicker(!initialUrl);
    setCaption("");
    setPlatforms([]);
    setScheduleOn(false);
    setWhen("");
    setErr("");
    Promise.all([
      fetch("/api/social/accounts").then((r) => r.json()).catch(() => ({})),
      fetch("/api/social/assets").then((r) => r.json()).catch(() => ({})),
    ]).then(([a, as]) => {
      setAccounts(a.accounts ?? []);
      setAssets(as.assets ?? []);
    });
  }, [open, initialUrl]);

  const toggle = (p: string) =>
    setPlatforms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  async function submit() {
    setErr("");
    if (!mediaUrl && !caption.trim()) return setErr("Add an image or a caption.");
    if (!platforms.length) return setErr("Pick at least one platform.");
    if (scheduleOn && !when) return setErr("Choose a date & time.");
    setBusy(true);
    try {
      const r = await fetch("/api/social/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          mediaUrls: mediaUrl ? [mediaUrl] : [],
          platforms,
          scheduleDate: scheduleOn ? when : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't post. Try again.");
      onDone?.();
      onClose();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-panel animate-fade-in-up relative z-10 flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="text-lg font-semibold text-foreground">Share to social</div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 transition-colors hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Media */}
          {mediaUrl && !picker ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="" className="max-h-64 w-full object-cover" />
              <button
                onClick={() => setPicker(true)}
                className="absolute bottom-2 right-2 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-[12px] font-medium text-white/50">Choose from your creations</div>
              {assets.length ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setMediaUrl(a.url);
                        setPicker(false);
                      }}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] transition-all hover:border-primary/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40">No generations yet — create one in Ad Studio.</p>
              )}
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="…or paste an image / video URL"
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-primary/30"
              />
              {mediaUrl && (
                <button onClick={() => setPicker(false)} className="mt-2 text-xs font-medium text-primary">
                  Use this →
                </button>
              )}
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Write a caption…"
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-primary/30 focus:shadow-[0_0_20px_rgb(245_227_29_/_0.06)]"
          />

          {/* Platforms */}
          <div className="mt-3">
            <div className="mb-2 text-[12px] font-medium text-white/50">Post to</div>
            {accounts.length ? (
              <div className="flex flex-wrap gap-2">
                {accounts.map((p) => (
                  <button
                    key={p}
                    onClick={() => toggle(p)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all",
                      platforms.includes(p)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-white/[0.06] bg-white/[0.03] text-white/40 hover:border-white/10 hover:text-white/60",
                    )}
                  >
                    {platforms.includes(p) && <Check className="h-3 w-3" />}
                    {title(p)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">No accounts linked — connect them in the Ayrshare dashboard.</p>
            )}
          </div>

          {/* Schedule */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={scheduleOn} onChange={(e) => setScheduleOn(e.target.checked)} />
              Schedule for later
            </label>
            {scheduleOn && (
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/70 outline-none focus:border-primary/30"
              />
            )}
          </div>

          {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-white/50 transition-colors hover:text-white/70">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="ad-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduleOn ? "Schedule" : "Post now"}
          </button>
        </div>
      </div>
    </div>
  );
}
