// GET  /api/social/autopilot — list this account's autopilot rules.
// POST /api/social/autopilot — create a rule. Body: { name, prompt, caption, platforms[], intervalHours, startAt? }.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("autopilot_rules")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rules: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const b = (await req.json()) as {
      name?: string;
      prompt?: string;
      caption?: string;
      platforms?: string[];
      intervalHours?: number;
      startAt?: string;
    };
    const prompt = String(b.prompt ?? "").trim().slice(0, 1000);
    const platforms = Array.isArray(b.platforms) ? b.platforms.filter((p) => typeof p === "string") : [];
    const intervalHours = Math.max(1, Math.min(Number(b.intervalHours) || 168, 24 * 30));
    if (!prompt) return NextResponse.json({ error: "Describe what to generate" }, { status: 400 });
    if (!platforms.length) return NextResponse.json({ error: "Pick at least one platform" }, { status: 400 });

    const nextRun =
      b.startAt && !Number.isNaN(Date.parse(b.startAt))
        ? new Date(b.startAt).toISOString()
        : new Date(Date.now() + intervalHours * 3_600_000).toISOString();

    const { data, error } = await admin
      .from("autopilot_rules")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        name: String(b.name ?? "Autopilot").slice(0, 80),
        prompt,
        caption: String(b.caption ?? "").slice(0, 2000),
        platforms,
        interval_hours: intervalHours,
        next_run_at: nextRun,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ rule: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
