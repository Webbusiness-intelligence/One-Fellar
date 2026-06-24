// Stores a product image (PNG buffer) and a best-effort background-removed
// cutout. The cutout (clean product, no background) is what we feed the image
// models for tighter compositing. bg-removal failure is non-fatal — we just
// fall back to the original. Server-only.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { falRun } from "./fal";

const BUCKET = "ad-studio";

export async function storeProductImage(
  admin: SupabaseClient,
  accountId: string,
  productId: string,
  png: Buffer,
): Promise<{ storagePath: string; cutoutPath: string | null }> {
  const base = `products/${accountId}/${productId}/${randomUUID()}`;
  const storagePath = `${base}.png`;
  const upload = await admin.storage
    .from(BUCKET)
    .upload(storagePath, png, { contentType: "image/png", upsert: true });
  if (upload.error) throw upload.error;

  let cutoutPath: string | null = null;
  try {
    const srcUrl = admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    const data = await falRun<{ image?: { url: string }; images?: Array<{ url: string }> }>(
      "fal-ai/bria/background/remove",
      { image_url: srcUrl },
    );
    const cutUrl = data.image?.url ?? data.images?.[0]?.url;
    if (cutUrl) {
      const bytes = new Uint8Array(await (await fetch(cutUrl)).arrayBuffer());
      const cp = `${base}-cut.png`;
      const cup = await admin.storage
        .from(BUCKET)
        .upload(cp, bytes, { contentType: "image/png", upsert: true });
      if (!cup.error) cutoutPath = cp;
    }
  } catch (e) {
    console.error("[ai-ads] background removal failed (non-fatal):", e);
  }
  return { storagePath, cutoutPath };
}
