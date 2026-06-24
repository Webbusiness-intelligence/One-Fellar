// /api/ai-ads/products
//   GET  — list the account's products (+ primary image public URL)
//   POST — create a product and upload its photo (multipart form-data)
//
// Writes go through the service-role client; reads are RLS-scoped via the
// caller's context. The `ad-studio` bucket is public, so image URLs are
// direct (no signing).

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { storeProductImage } from "@/lib/ai-ads/product-image";

const BUCKET = "ad-studio";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  ad_product_images: Array<{ storage_path: string; is_primary: boolean }>;
}

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("ad_products")
      .select("id, name, description, ad_product_images(storage_path, is_primary)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const products = ((data ?? []) as ProductRow[]).map((p) => {
      const imgs = p.ad_product_images ?? [];
      const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: primary
          ? ctx.supabase.storage.from(BUCKET).getPublicUrl(primary.storage_path).data.publicUrl
          : null,
      };
    });
    return NextResponse.json({ products });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim() || null;
    const file = form.get("image");

    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A product image is required" }, { status: 400 });
    }

    // Normalize any upload (avif/heic/jpg/webp/…) to PNG so both storage
    // and Bria Product Shot accept it; apply EXIF orientation, cap the size.
    let png: Buffer;
    try {
      png = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Could not read that image. Try a PNG, JPG, or WEBP." },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();
    const { data: product, error: insErr } = await admin
      .from("ad_products")
      .insert({ account_id: ctx.accountId, created_by: ctx.userId, name, description })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { storagePath, cutoutPath } = await storeProductImage(
      admin,
      ctx.accountId,
      product.id,
      png,
    );
    const imgErr = (
      await admin.from("ad_product_images").insert({
        account_id: ctx.accountId,
        product_id: product.id,
        storage_path: storagePath,
        cutout_path: cutoutPath,
        is_primary: true,
      })
    ).error;
    if (imgErr) throw imgErr;

    return NextResponse.json({ id: product.id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
