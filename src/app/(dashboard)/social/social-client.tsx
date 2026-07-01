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
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
      {p.media_urls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.media_urls[0]} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{p.caption || "(no caption)"}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
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
    <div className="mx-auto max-w-5xl py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Social planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">Schedule your creations across your connected accounts.</p>
        </div>
        <button
          onClick={() => setDialog(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {accounts && accounts.length === 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          No accounts linked yet — connect Instagram / TikTok / Facebook in your Ayrshare dashboard, then refresh.
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Calendar */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-base font-semibold text-foreground">
              {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelDay(dayKey(d));
                }}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Today
              </button>
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {WD.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const k = dayKey(d);
              const ps = byDay[k] ?? [];
              return (
                <button
                  key={i}
                  onClick={() => setSelDay(k)}
                  className={cn(
                    "flex min-h-[74px] flex-col rounded-lg border p-1.5 text-left transition-colors",
                    inMonth(d) ? "border-border" : "border-transparent opacity-40",
                    selDay === k ? "ring-2 ring-primary/50" : "hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 text-[11px]",
                      isToday(d)
                        ? "grid h-5 w-5 place-items-center rounded-full bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground",
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
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">
            {selDate ? selDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Pick a day"}
          </div>
          {dayPosts.length ? (
            <ul className="space-y-2">
              {dayPosts.map((p) => (
                <PostRow key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nothing here.{" "}
              <button onClick={() => setDialog(true)} className="font-medium text-primary">
                Add a post →
              </button>
            </p>
          )}
        </div>
      </div>

      <AutopilotPanel />

      <ScheduleDialog open={dialog} onClose={() => setDialog(false)} onDone={load} />
    </div>
  );
}
