// /api/ai-ads/chat/[id]
//   GET    → messages of a chat (attachment + asset URLs resolved)
//   DELETE → delete the chat (messages cascade)

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";

const BUCKET = "ad-studio";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");
    const pub = (path: string) => ctx.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const { data: msgs, error } = await ctx.supabase
      .from("ad_chat_messages")
      .select("id, role, text, attachments, asset_ids, metadata, created_at")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const assetIds = [
      ...new Set((msgs ?? []).flatMap((m) => (m.asset_ids as string[]) ?? [])),
    ];
    const assetMap: Record<
      string,
      { url: string; favorite: boolean; label: string; type: "image" | "video" }
    > = {};
    if (assetIds.length) {
      const { data: assets } = await ctx.supabase
        .from("ad_assets")
        .select("id, type, storage_path, favorite, metadata")
        .in("id", assetIds);
      for (const a of assets ?? []) {
        assetMap[a.id] = {
          url: pub(a.storage_path),
          favorite: !!a.favorite,
          label: ((a.metadata as { prompt?: string })?.prompt ?? "Image").slice(0, 80),
          type: a.type === "video" ? "video" : "image",
        };
      }
    }

    const messages = (msgs ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      attachments: ((m.attachments as string[]) ?? []).map((a) =>
        a.startsWith("http") ? a : pub(a),
      ),
      assets: ((m.asset_ids as string[]) ?? [])
        .map((aid) => (assetMap[aid] ? { id: aid, ...assetMap[aid] } : null))
        .filter(Boolean),
      suggestions: ((m.metadata as { suggestions?: string[] })?.suggestions ?? []) as string[],
      error: !!(m.metadata as { error?: boolean })?.error,
    }));

    return NextResponse.json({ messages });
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
      .from("ad_chats")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
