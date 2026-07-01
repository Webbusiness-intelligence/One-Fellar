"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar, ArrowRight } from "lucide-react";

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

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function StatusDot({ s }: { s: Post["status"] }) {
  const c = s === "posted" ? "bg-emerald-400" : s === "failed" ? "bg-destructive" : "bg-primary";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", c)} />;
}

// Brand icons were removed from lucide, so platforms show as brand-coloured dots.
const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E4405F",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#25F4EE",
  twitter: "#ffffff",
  x: "#ffffff",
  pinterest: "#E60023",
};
const STATUS: Record<Post["status"], { dot: string; text: string; label: string }> = {
  posted: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Posted" },
  failed: { dot: "bg-destructive", text: "text-destructive", label: "Failed" },
  scheduled: { dot: "bg-primary", text: "text-primary", label: "Scheduled" },
};

function PlatformIcon({ id, size = 8 }: { id: string; size?: number }) {
  const color = PLATFORM_COLOR[id.toLowerCase()] ?? "#ffffff";
  return (
    <span className="inline-block rounded-full" style={{ background: color, width: size, height: size }} />
  );
}

// Hover preview that pops above a calendar post thumbnail.
function PostTooltip({ p }: { p: Post }) {
  const st = STATUS[p.status];
  const t = new Date(p.scheduled_at ?? p.created_at);
  return (
    <div className="dropdown-solid animate-fade-in-up absolute bottom-full left-0 z-[60] mb-2 w-60 overflow-hidden rounded-xl">
      <div className="relative h-28">
        {p.media_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.media_urls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-white/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-3 bottom-2">
          <div className="mb-1 flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            <span className={cn("text-[10px] font-semibold", st.text)}>{st.label}</span>
          </div>
          <p className="truncate text-[11px] font-medium text-white/70">{p.caption || "(no caption)"}</p>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {p.platforms.slice(0, 4).map((pl) => (
              <span key={pl} className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06]">
                <PlatformIcon id={pl} size={11} />
              </span>
            ))}
            {p.platforms.length > 4 && (
              <span className="ml-0.5 text-[9px] text-white/30">+{p.platforms.length - 4}</span>
            )}
          </div>
          <span className="text-[10px] text-white/30">
            {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
        {p.error && <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-destructive">{p.error}</p>}
      </div>
    </div>
  );
}

// Rich post card for the day-detail sidebar (mirrors the Kimi planner).
function DayPostCard({ p }: { p: Post }) {
  const st = STATUS[p.status];
  const t = new Date(p.scheduled_at ?? p.created_at);
  const time = t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const media = p.media_urls[0];
  return (
    <div className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-primary/15">
      {media ? (
        <div className="relative h-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            <span className={cn("text-[9px] font-semibold", st.text)}>{st.label}</span>
          </div>
          <div className="absolute inset-x-2 bottom-2">
            <p className="truncate text-[11px] font-medium text-white/80">{p.caption || "(no caption)"}</p>
          </div>
        </div>
      ) : null}
      <div className="p-2.5">
        {!media && (
          <>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
              <span className={cn("text-[9px] font-semibold", st.text)}>{st.label}</span>
            </div>
            <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-white/60">{p.caption || "(no caption)"}</p>
          </>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {p.platforms.map((pl) => (
              <span key={pl} className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04]">
                <PlatformIcon id={pl} size={9} />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <Clock className="size-2.5" /> {time}
          </div>
        </div>
        {p.error && (
          <p className="mt-2 line-clamp-2 border-t border-white/[0.04] pt-2 text-[10px] text-destructive">{p.error}</p>
        )}
      </div>
    </div>
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
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

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
  const monthStats = useMemo(() => {
    const inM = posts.filter((p) => {
      const d = new Date(p.scheduled_at ?? p.created_at);
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    return {
      scheduled: inM.filter((p) => p.status === "scheduled").length,
      posted: inM.filter((p) => p.status === "posted").length,
      failed: inM.filter((p) => p.status === "failed").length,
    };
  }, [posts, month]);

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
                <div
                  key={i}
                  onClick={() => inMonth(d) && setSelDay(k)}
                  onMouseEnter={() => inMonth(d) && setHoveredDay(k)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={cn(
                    "relative flex min-h-[90px] cursor-pointer flex-col rounded-xl border p-1.5 text-left transition-all",
                    selDay === k
                      ? "border-primary/30 bg-primary/[0.04]"
                      : inMonth(d)
                        ? "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]"
                        : "border-transparent opacity-40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center text-[12px] font-medium",
                        isToday(d)
                          ? "rounded-full bg-primary font-semibold text-primary-foreground"
                          : inMonth(d)
                            ? "text-white/60"
                            : "text-white/15",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {ps.length > 0 && <span className="text-[9px] font-bold text-white/20">{ps.length}</span>}
                  </div>

                  {ps.length > 0 && (
                    <div className="flex flex-wrap content-start gap-0.5">
                      {ps.slice(0, 4).map((p) => (
                        <div
                          key={p.id}
                          className="relative shrink-0"
                          style={{
                            width: ps.length === 1 ? "100%" : ps.length === 2 ? "calc(50% - 2px)" : "calc(33% - 2px)",
                            aspectRatio: "1 / 1",
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredPost(p.id);
                          }}
                          onMouseLeave={() => setHoveredPost(null)}
                        >
                          <div className="relative h-full w-full overflow-hidden rounded-md bg-white/5">
                            {p.media_urls[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.media_urls[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="grid h-full w-full place-items-center">
                                <StatusDot s={p.status} />
                              </span>
                            )}
                            <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
                              {p.platforms.slice(0, 2).map((pl) => (
                                <span
                                  key={pl}
                                  className="flex h-2.5 w-2.5 items-center justify-center rounded-sm bg-black/50 backdrop-blur"
                                >
                                  <PlatformIcon id={pl} size={7} />
                                </span>
                              ))}
                            </div>
                            <span className={cn("absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full", STATUS[p.status].dot)} />
                          </div>
                          {hoveredPost === p.id && <PostTooltip p={p} />}
                        </div>
                      ))}
                      {ps.length > 4 && (
                        <div className="mt-0.5 w-full text-center text-[9px] text-white/25">+{ps.length - 4} more</div>
                      )}
                    </div>
                  )}

                  {inMonth(d) && ps.length === 0 && hoveredDay === k && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-white/25">
                        <Plus className="size-3" />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: day detail + month summary */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="glass-panel rounded-2xl border border-white/[0.07] p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-foreground">
                {selDate ? selDate.toLocaleDateString(undefined, { month: "long", day: "numeric" }) : "Pick a day"}
              </h3>
              {selDate && (
                <button
                  onClick={() => setDialog(true)}
                  className="shrink-0 text-[11px] font-medium text-primary/60 transition-colors hover:text-primary"
                >
                  Add a post <ArrowRight className="inline size-2.5" />
                </button>
              )}
            </div>
            {dayPosts.length ? (
              <div className="space-y-3">
                {dayPosts.map((p) => (
                  <DayPostCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                  <Calendar className="size-5 text-white/15" />
                </div>
                <p className="mb-1 text-[12px] text-white/30">Nothing here.</p>
                <button
                  onClick={() => setDialog(true)}
                  className="text-[11px] font-medium text-primary/60 transition-colors hover:text-primary"
                >
                  Add a post <ArrowRight className="inline size-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* This month */}
          <div className="glass-panel rounded-2xl border border-white/[0.07] p-5">
            <h3 className="mb-3 text-[13px] font-semibold text-foreground">This month</h3>
            <div className="space-y-2.5">
              {[
                { label: "Scheduled", count: monthStats.scheduled, color: "var(--primary)" },
                { label: "Posted", count: monthStats.posted, color: "#34d399" },
                { label: "Failed", count: monthStats.failed, color: "#f87171" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-[12px] text-white/50">{s.label}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AutopilotPanel />

      <ScheduleDialog open={dialog} onClose={() => setDialog(false)} onDone={load} />
    </div>
  );
}
