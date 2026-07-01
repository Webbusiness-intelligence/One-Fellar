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
      <div className="relative z-10 flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-sm font-semibold text-foreground">Share to social</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
                className="absolute bottom-2 right-2 rounded-md border border-border bg-background/85 px-2.5 py-1 text-xs backdrop-blur-sm hover:bg-background"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Choose from your creations</div>
              {assets.length ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setMediaUrl(a.url);
                        setPicker(false);
                      }}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No generations yet — create one in Ad Studio.</p>
              )}
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="…or paste an image / video URL"
                className="mt-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
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
            className="mt-4 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
          />

          {/* Platforms */}
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Post to</div>
            {accounts.length ? (
              <div className="flex flex-wrap gap-2">
                {accounts.map((p) => (
                  <button
                    key={p}
                    onClick={() => toggle(p)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      platforms.includes(p)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {platforms.includes(p) && <Check className="h-3 w-3" />}
                    {title(p)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No accounts linked — connect them in the Ayrshare dashboard.</p>
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
                className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
            )}
          </div>

          {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduleOn ? "Schedule" : "Post now"}
          </button>
        </div>
      </div>
    </div>
  );
}
