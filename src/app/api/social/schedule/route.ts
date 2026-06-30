// POST /api/social/schedule — post now or schedule a post via Ayrshare, and record it.
// Body: { caption, mediaUrls[], platforms[], scheduleDate? (ISO) }.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { postToSocial } from "@/lib/ayrshare";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();

    const body = (await req.json()) as {
      caption?: string;
      mediaUrls?: string[];
      platforms?: string[];
      scheduleDate?: string;
    };
    const caption = String(body.caption ?? "").trim().slice(0, 2000);
    const platforms = Array.isArray(body.platforms) ? body.platforms.filter((p) => typeof p === "string") : [];
    const mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((u) => typeof u === "string") : [];
    const scheduleDate =
      body.scheduleDate && !Number.isNaN(Date.parse(body.scheduleDate))
        ? new Date(body.scheduleDate).toISOString()
        : undefined;

    if (!platforms.length) return NextResponse.json({ error: "Pick at least one platform" }, { status: 400 });
    if (!caption && !mediaUrls.length) return NextResponse.json({ error: "Add a caption or media" }, { status: 400 });

    let ayrshareId: string | undefined;
    let status: "scheduled" | "posted" | "failed" = scheduleDate ? "scheduled" : "posted";
    let error: string | null = null;
    try {
      const r = await postToSocial({ post: caption || " ", platforms, mediaUrls, scheduleDate });
      ayrshareId = r.id;
    } catch (e) {
      status = "failed";
      error = String((e as Error)?.message ?? e);
    }

    const { data, error: dbErr } = await admin
      .from("scheduled_posts")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        caption,
        media_urls: mediaUrls,
        platforms,
        scheduled_at: scheduleDate ?? null,
        status,
        ayrshare_id: ayrshareId ?? null,
        error,
      })
      .select("*")
      .single();
    if (dbErr) throw dbErr;

    if (error) return NextResponse.json({ post: data, error }, { status: 502 });
    return NextResponse.json({ post: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
