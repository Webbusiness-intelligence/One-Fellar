"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface Post {
  id: string;
  caption: string;
  media_urls: string[];
  platforms: string[];
  scheduled_at: string | null;
  status: "scheduled" | "posted" | "failed";
  error: string | null;
  created_at: string;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SocialClient() {
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const [acctError, setAcctError] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);

  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/social/accounts");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load connected accounts");
      setAccounts(j.accounts ?? []);
    } catch (e) {
      setAccounts([]);
      setAcctError(String((e as Error).message));
    }
  }
  async function loadPosts() {
    const r = await fetch("/api/social/posts");
    const j = await r.json();
    if (r.ok) setPosts(j.posts ?? []);
  }
  useEffect(() => {
    loadAccounts();
    loadPosts();
  }, []);

  const toggle = (p: string) =>
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  async function submit() {
    setMsg(null);
    if (!picked.length) return setMsg({ kind: "err", text: "Pick at least one platform." });
    if (!caption.trim() && !mediaUrl.trim()) return setMsg({ kind: "err", text: "Add a caption or an image URL." });
    setBusy(true);
    try {
      const r = await fetch("/api/social/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          mediaUrls: mediaUrl.trim() ? [mediaUrl.trim()] : [],
          platforms: picked,
          scheduleDate: when || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't post. Try again.");
      setMsg({ kind: "ok", text: when ? "Scheduled ✓" : "Posted ✓" });
      setCaption("");
      setMediaUrl("");
      setWhen("");
      loadPosts();
    } catch (e) {
      setMsg({ kind: "err", text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  const badge = (s: Post["status"]) =>
    s === "posted"
      ? "text-emerald-400 border-emerald-400/30"
      : s === "failed"
        ? "text-destructive border-destructive/30"
        : "text-primary border-primary/30";

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Social</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Post or schedule your creations to your connected social accounts.
      </p>

      {/* Connected accounts */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Connected accounts</div>
        {accounts === null ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : accounts.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((a) => (
              <span key={a} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                {title(a)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {acctError ? `${acctError}. ` : ""}No accounts linked yet — connect Instagram / TikTok / Facebook in your
            Ayrshare dashboard, then refresh.
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">New post</div>

        <input
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="Image/video URL (paste a generated image's link)"
          className="mt-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          rows={3}
          className="mt-2 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {(accounts ?? []).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                picked.includes(p)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {title(p)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground">
            Schedule for{" "}
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
          <span className="text-xs text-muted-foreground">(leave blank to post now)</span>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {when ? "Schedule" : "Post now"}
          </button>
        </div>
        {msg && (
          <p className={cn("mt-2 text-xs", msg.kind === "ok" ? "text-emerald-400" : "text-destructive")}>{msg.text}</p>
        )}
      </div>

      {/* History */}
      <div className="mt-6">
        <div className="mb-2 text-sm font-medium text-foreground">Recent posts</div>
        {posts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                {p.media_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media_urls[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{p.caption || "(no caption)"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.platforms.map(title).join(", ")} ·{" "}
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "now"}
                    {p.error ? ` · ${p.error}` : ""}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] capitalize", badge(p.status))}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
