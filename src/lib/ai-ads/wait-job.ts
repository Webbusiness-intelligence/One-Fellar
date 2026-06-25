"use client";

// Wait for an ad_jobs row to finish using Supabase Realtime, with a polling
// fallback so it ALWAYS resolves even if a Realtime message is missed. Used by the
// Create + Video composers after enqueueing a job.
import { createClient } from "@/lib/supabase/client";

export type JobOutcome = { status: "completed" | "failed" | "timeout"; error?: string };

export function waitForJob(
  jobId: string,
  opts?: { onProgress?: (progress: string | null) => void; timeoutMs?: number },
): Promise<JobOutcome> {
  const supabase = createClient();
  const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000;

  return new Promise<JobOutcome>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let to: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`job-${jobId}`);

    const finish = (r: JobOutcome) => {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      if (to) clearTimeout(to);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
      resolve(r);
    };
    const handle = (status?: string, error?: string | null) => {
      if (status === "completed") finish({ status: "completed" });
      else if (status === "failed") finish({ status: "failed", error: error ?? undefined });
    };

    // Realtime: instant updates on this job row.
    channel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ad_jobs", filter: `id=eq.${jobId}` },
        (payload: { new?: { status?: string; progress?: string | null; error?: string | null } }) => {
          const n = payload.new ?? {};
          opts?.onProgress?.(n.progress ?? null);
          handle(n.status, n.error);
        },
      )
      .subscribe();

    // Polling fallback (also covers the window before the subscription is live).
    const poll = async () => {
      try {
        const r = await fetch(`/api/ai-ads/jobs/${jobId}`);
        const s = JSON.parse(await r.text()) as { status?: string; progress?: string | null; error?: string | null };
        opts?.onProgress?.(s.progress ?? null);
        handle(s.status, s.error);
      } catch {
        /* transient — keep waiting */
      }
    };
    timer = setInterval(poll, 4000);
    to = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    void poll(); // immediate first check
  });
}
