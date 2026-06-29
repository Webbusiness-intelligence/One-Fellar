// /api/ai-ads/products/scrape  (POST)  { url }
// Reads a product page (og: tags), downloads its main image, and creates a
// product — the "Click to Ad" flow.

import { NextResponse } from "next/server";
import sharp from "sharp";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scrapeProduct } from "@/lib/ai-ads/scrape";
import { storeProductImage } from "@/lib/ai-ads/product-image";

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const { url } = (await req.json()) as { url?: string };
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Enter a valid product URL" }, { status: 400 });
    }

    const { title, description, imageUrl } = await scrapeProduct(url);
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Couldn't find a product image on that page" },
        { status: 400 },
      );
    }

    let png: Buffer;
    try {
      const imgRes = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AwtoadsBot/1.0)" },
      });
      if (!imgRes.ok) throw new Error("image fetch failed");
      png = await sharp(Buffer.from(await imgRes.arrayBuffer()))
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "Couldn't load the product image" }, { status: 400 });
    }

    // Trim a trailing " | Brand" / " – Site" suffix off the title.
    const name = (title.split(/\s[|–—-]\s/)[0] || title).trim().slice(0, 80) || "Product";

    const admin = supabaseAdmin();
    const { data: product, error: insErr } = await admin
      .from("ad_products")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        name,
        description: description.slice(0, 500) || null,
        source_url: url,
      })
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

    return NextResponse.json({ id: product.id, name });
  } catch (err) {
    return toErrorResponse(err);
  }
}
