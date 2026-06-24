import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { GalleryClient } from "./gallery-client";
import { StudioNav } from "../studio-nav";
import { UsageMeter } from "../usage-meter";

const BUCKET = "ad-studio";

interface AssetRow {
  id: string;
  storage_path: string;
  favorite: boolean;
  created_at: string;
  metadata: { label?: string; model?: string; scene?: string } | null;
  ad_jobs:
    | { prompt: string | null; model: string | null }
    | { prompt: string | null; model: string | null }[]
    | null;
}

export default async function GalleryPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_assets")
    .select("id, storage_path, favorite, created_at, metadata, ad_jobs!inner(prompt, model)")
    .order("created_at", { ascending: false })
    .limit(160);

  const items = ((data ?? []) as AssetRow[]).map((a) => {
    const job = Array.isArray(a.ad_jobs) ? a.ad_jobs[0] : a.ad_jobs;
    const prompt = job?.prompt ?? "";
    return {
      id: a.id,
      url: ctx.supabase.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
      label: prompt || a.metadata?.label || "Ad",
      scene: a.metadata?.scene || prompt || undefined,
      favorite: a.favorite,
      model: a.metadata?.model ?? job?.model ?? "",
    };
  });

  return (
    <div>
      <StudioNav active="gallery" />
      <div className="mx-auto mb-4 max-w-6xl">
        <UsageMeter />
      </div>
      <GalleryClient initialItems={items} />
    </div>
  );
}
