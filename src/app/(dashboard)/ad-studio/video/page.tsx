import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { StudioNav } from "../studio-nav";
import { VideoClient, type VideoItem } from "./video-client";

const BUCKET = "ad-studio";

interface VideoRow {
  id: string;
  storage_path: string;
  metadata: { summary?: string; prompt?: string; duration?: number } | null;
}

export default async function VideoPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_assets")
    .select("id, storage_path, metadata, created_at")
    .eq("type", "video")
    .contains("metadata", { studio: "video" })
    .order("created_at", { ascending: false })
    .limit(60);

  const initial: VideoItem[] = ((data ?? []) as VideoRow[]).map((r) => ({
    id: r.id,
    url: ctx.supabase.storage.from(BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
    label: r.metadata?.summary || r.metadata?.prompt || "Video",
    duration: r.metadata?.duration,
  }));

  return (
    <div>
      <StudioNav active="video" />
      <VideoClient initial={initial} />
    </div>
  );
}
