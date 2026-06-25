// /api/ai-ads/jobs/[id]  (GET) — job status + finished assets, for the client to
// poll after enqueuing. Account-scoped via RLS (ctx.supabase).
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";

const BUCKET = "ad-studio";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const pub = (p: string) => ctx.supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const { data: job, error } = await ctx.supabase
      .from("ad_jobs")
      .select("id, type, status, progress, error, estimated_credits, actual_credits")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let assets: Array<{ id: string; url: string; type: string; label: string; duration?: number }> = [];
    if (job.status === "completed") {
      const { data: rows } = await ctx.supabase
        .from("ad_assets")
        .select("id, type, storage_path, metadata, variation_index")
        .eq("job_id", id)
        .order("variation_index", { ascending: true });
      assets = (rows ?? []).map((a) => {
        const m = (a.metadata as { summary?: string; prompt?: string; duration?: number }) ?? {};
        return {
          id: a.id as string,
          url: pub(a.storage_path as string),
          type: a.type === "video" ? "video" : "image",
          label: (m.summary ?? m.prompt ?? "").slice(0, 80),
          duration: m.duration,
        };
      });
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress ?? null,
      error: job.status === "failed" ? job.error : null,
      assets,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
