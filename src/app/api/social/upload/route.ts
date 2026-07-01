// POST /api/social/upload — upload a reference image; returns a public URL.
// Multipart form with `file`. Used by the Autopilot reference picker (upload option).
import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "ad-studio";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });

    const png = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const path = `uploads/${ctx.accountId}/${randomUUID()}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (err) {
    return toErrorResponse(err);
  }
}
