// /api/ai-ads/commercial/[id]
//   GET    → the project + its scenes (+ resolved asset urls)
//   PATCH  → tweak a scene { sceneId, prompt?, duration?, locked?, lockedAssetId? }
//   DELETE → remove the project

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const BUCKET = "ad-studio";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const { data: project } = await admin
      .from("ad_commercials")
      .select("id, title, brief, preset, format, duration_target, asset_ids, bible, status, final_asset_id")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: scenes } = await admin
      .from("ad_commercial_scenes")
      .select("id, idx, summary, keyframe_prompt, prompt, duration, keyframe_asset_id, variation_asset_ids, locked_asset_id, locked, status")
      .eq("commercial_id", id)
      .order("idx", { ascending: true });

    // Resolve every referenced asset id → {url, type}.
    const ids = new Set<string>();
    for (const s of scenes ?? []) {
      if (s.keyframe_asset_id) ids.add(s.keyframe_asset_id as string);
      if (s.locked_asset_id) ids.add(s.locked_asset_id as string);
      for (const v of (s.variation_asset_ids as string[]) ?? []) ids.add(v);
    }
    if (project.final_asset_id) ids.add(project.final_asset_id as string);
    const registry = (((project.bible as { assets?: Array<{ id: string }> })?.assets) ?? []) as Array<{
      id: string;
    }>;
    for (const a of registry) if (a.id) ids.add(a.id);
    const assetMap: Record<string, { url: string; type: string }> = {};
    if (ids.size) {
      const { data: assets } = await admin
        .from("ad_assets")
        .select("id, storage_path, type")
        .in("id", [...ids]);
      for (const a of assets ?? [])
        assetMap[a.id] = { url: pub(a.storage_path as string), type: (a.type as string) ?? "image" };
    }

    return NextResponse.json({ project, scenes: scenes ?? [], assets: assetMap });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const body = (await req.json()) as {
      sceneId: string;
      prompt?: string;
      duration?: number;
      locked?: boolean;
      lockedAssetId?: string;
    };
    if (!body.sceneId) return NextResponse.json({ error: "No scene" }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.prompt === "string") patch.prompt = body.prompt.slice(0, 4000);
    if ([3, 5, 10].includes(Number(body.duration))) patch.duration = Number(body.duration);
    if (typeof body.locked === "boolean") patch.locked = body.locked;
    if (typeof body.lockedAssetId === "string") patch.locked_asset_id = body.lockedAssetId;

    const { error } = await admin
      .from("ad_commercial_scenes")
      .update(patch)
      .eq("id", body.sceneId)
      .eq("commercial_id", id)
      .eq("account_id", ctx.accountId);
    if (error) throw error;
    await admin.from("ad_commercials").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("ad_commercials")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
