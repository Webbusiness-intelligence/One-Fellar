"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScheduleDialog } from "./schedule-dialog";
import { AutopilotPanel } from "./autopilot-panel";

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
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function StatusDot({ s }: { s: Post["status"] }) {
  const c = s === "posted" ? "bg-emerald-400" : s === "failed" ? "bg-destructive" : "bg-primary";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", c)} />;
}

function PostRow({ p }: { p: Post }) {
  const t = new Date(p.scheduled_at ?? p.created_at);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-primary/15">
      {p.media_urls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.media_urls[0]} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-md bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{p.caption || "(no caption)"}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
          <StatusDot s={p.status} />
          <span className="capitalize">{p.status}</span>·<span>{p.platforms.map(title).join(", ")}</span>·
          <span>{t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        {p.error && <div className="mt-0.5 truncate text-[11px] text-destructive">{p.error}</div>}
      </div>
    </li>
  );
}

export function SocialClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selDay, setSelDay] = useState<string | null>(() => dayKey(new Date()));
  const [dialog, setDialog] = useState(false);

  async function load() {
    const r = await fetch("/api/social/posts");
    const j = await r.json();
    if (r.ok) setPosts(j.posts ?? []);
  }
  useEffect(() => {
    load();
    fetch("/api/social/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []))
      .catch(() => setAccounts([]));
  }, []);

  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    for (const p of posts) {
      const k = dayKey(new Date(p.scheduled_at ?? p.created_at));
      (m[k] ??= []).push(p);
    }
    return m;
  }, [posts]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const inMonth = (d: Date) => d.getMonth() === month.getMonth();
  const selDate = selDay ? (([y, m, d]) => new Date(y, m, d))(selDay.split("-").map(Number)) : null;
  const dayPosts = selDay ? byDay[selDay] ?? [] : [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Social planner</h1>
          <p className="mt-1 text-[13px] text-white/40">Schedule your creations across your connected accounts.</p>
        </div>
        <button
          onClick={() => setDialog(true)}
          className="ad-cta inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> New post
        </button>
      </div>

      {accounts && accounts.length === 0 && (
        <div className="glass-panel mb-5 rounded-xl border border-white/[0.07] p-3 text-xs text-white/50">
          No accounts linked yet — connect Instagram / TikTok / Facebook in your Ayrshare dashboard, then refresh.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Calendar */}
        <div className="glass-panel rounded-2xl border border-white/[0.07] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-[16px] font-semibold text-foreground">
              {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="flex size-8 items-center justify-center rounded-lg text-white/30 transition-all hover:bg-white/[0.04] hover:text-white/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelDay(dayKey(d));
                }}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/40 transition-all hover:bg-white/[0.04] hover:text-white/60"
              >
                Today
              </button>
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="flex size-8 items-center justify-center rounded-lg text-white/30 transition-all hover:bg-white/[0.04] hover:text-white/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wider text-white/30">
            {WD.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const k = dayKey(d);
              const ps = byDay[k] ?? [];
              return (
                <button
                  key={i}
                  onClick={() => setSelDay(k)}
                  className={cn(
                    "flex min-h-[90px] flex-col rounded-xl border p-1.5 text-left transition-all",
                    selDay === k
                      ? "border-primary/30 bg-primary/[0.04]"
                      : inMonth(d)
                        ? "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]"
                        : "border-transparent opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 grid h-6 w-6 place-items-center text-[12px] font-medium",
                      isToday(d)
                        ? "rounded-full bg-primary font-semibold text-primary-foreground"
                        : inMonth(d)
                          ? "text-white/60"
                          : "text-white/15",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="flex flex-1 flex-wrap content-start gap-1 overflow-hidden">
                    {ps.slice(0, 4).map((p) =>
                      p.media_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p.id} src={p.media_urls[0]} alt="" className="h-5 w-5 rounded object-cover" />
                      ) : (
                        <StatusDot key={p.id} s={p.status} />
                      ),
                    )}
                    {ps.length > 4 && <span className="text-[10px] text-muted-foreground">+{ps.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        <div className="glass-panel rounded-2xl border border-white/[0.07] p-5 lg:sticky lg:top-4">
          <div className="mb-4 text-[14px] font-semibold text-foreground">
            {selDate ? selDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Pick a day"}
          </div>
          {dayPosts.length ? (
            <ul className="space-y-3">
              {dayPosts.map((p) => (
                <PostRow key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <Plus className="size-5 text-white/15" />
              </div>
              <p className="mb-1 text-[12px] text-white/30">Nothing here.</p>
              <button
                onClick={() => setDialog(true)}
                className="text-[11px] font-medium text-primary/70 transition-colors hover:text-primary"
              >
                Add a post →
              </button>
            </div>
          )}
        </div>
      </div>

      <AutopilotPanel />

      <ScheduleDialog open={dialog} onClose={() => setDialog(false)} onDone={load} />
    </div>
  );
}
