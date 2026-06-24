import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { StudioNav } from "../studio-nav";
import { SoulClient, type SoulItem } from "./soul-client";

const BUCKET = "ad-studio";

interface SoulRow {
  id: string;
  handle: string;
  name: string;
  kind: string;
  source: string;
  storage_path: string;
}

export default async function SoulPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_soul_ids")
    .select("id, handle, name, kind, source, storage_path")
    .order("created_at", { ascending: false });

  const initial: SoulItem[] = ((data ?? []) as SoulRow[]).map((r) => ({
    id: r.id,
    handle: r.handle,
    name: r.name,
    kind: r.kind,
    source: r.source,
    url: ctx.supabase.storage.from(BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
  }));

  return (
    <div>
      <StudioNav active="soul" />
      <SoulClient initial={initial} />
    </div>
  );
}
