"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Inbox } from "lucide-react";

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

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
const STATUS: Record<Post["status"], { dot: string; label: string; pill: string }> = {
  posted: { dot: "bg-emerald-400", label: "Posted", pill: "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  failed: { dot: "bg-red-400", label: "Failed", pill: "border border-red-400/20 bg-red-400/10 text-red-300" },
  scheduled: { dot: "bg-primary", label: "Scheduled", pill: "border border-primary/25 bg-primary/10 text-primary" },
};

type Filter = "all" | "scheduled" | "posted" | "failed";

export function PostsClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/social/posts")
      .then((r) => r.json())
      .then((j) => setPosts(j.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      all: posts.length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      posted: posts.filter((p) => p.status === "posted").length,
      failed: posts.filter((p) => p.status === "failed").length,
    }),
    [posts],
  );

  const rows = useMemo(() => {
    const list = filter === "all" ? posts : posts.filter((p) => p.status === filter);
    return [...list].sort(
      (a, b) =>
        new Date(b.scheduled_at ?? b.created_at).getTime() - new Date(a.scheduled_at ?? a.created_at).getTime(),
    );
  }, [posts, filter]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">All posts</h1>
          <p className="mt-1 text-[13px] text-white/40">Everything scheduled, posted or failed across your channels.</p>
        </div>
        <Link
          href="/social"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-white/60 transition-all hover:border-white/10 hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" /> Planner
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "scheduled", "posted", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all",
              filter === f
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:border-white/10 hover:text-white/80",
            )}
          >
            {titleCase(f)}
            <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/[0.07]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/30">
              <th className="px-4 py-3 font-medium">Post</th>
              <th className="px-4 py-3 font-medium">Platforms</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const t = new Date(p.scheduled_at ?? p.created_at);
              const st = STATUS[p.status];
              return (
                <tr key={p.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.media_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.media_urls[0]} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-white/5" />
                      )}
                      <div className="min-w-0">
                        <div className="line-clamp-1 max-w-md text-white/80">{p.caption || "(no caption)"}</div>
                        {p.error && <div className="mt-0.5 line-clamp-1 max-w-md text-[11px] text-red-400/80">{p.error}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {p.platforms.map((pl) => (
                        <span
                          key={pl}
                          title={titleCase(pl)}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: PLATFORM_COLOR[pl.toLowerCase()] ?? "#ffffff" }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", st.pill)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                      {st.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white/50">
                    {t.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · "}
                    {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-white/30">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <Inbox className="size-5 text-white/15" />
            </div>
            <p className="text-[13px] text-white/30">No {filter === "all" ? "" : filter} posts yet.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
