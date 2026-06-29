// /api/ai-ads/products/[id]/images
//   GET  — list a product's photos
//   POST — add a photo (multipart, normalized to PNG, max 5 per product)

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storeProductImage } from "@/lib/ai-ads/product-image";

const BUCKET = "ad-studio";
const MAX_PHOTOS = 5;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("ad_product_images")
      .select("id, storage_path, is_primary, created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const images = (data ?? []).map((im) => ({
      id: im.id,
      url: ctx.supabase.storage.from(BUCKET).getPublicUrl(im.storage_path).data.publicUrl,
      isPrimary: im.is_primary,
    }));
    return NextResponse.json({ images });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRole("agent");

    const { data: product } = await ctx.supabase
      .from("ad_products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { count } = await ctx.supabase
      .from("ad_product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if ((count ?? 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: `Max ${MAX_PHOTOS} photos per product` }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An image is required" }, { status: 400 });
    }

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
    const { storagePath, cutoutPath } = await storeProductImage(admin, ctx.accountId, id, png);

    const ins = await admin
      .from("ad_product_images")
      .insert({
        account_id: ctx.accountId,
        product_id: id,
        storage_path: storagePath,
        cutout_path: cutoutPath,
        is_primary: false,
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;

    const url = admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    return NextResponse.json({ id: ins.data.id, url, isPrimary: false });
  } catch (err) {
    return toErrorResponse(err);
  }
}
