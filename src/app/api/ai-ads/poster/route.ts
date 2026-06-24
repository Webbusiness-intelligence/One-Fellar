// /api/ai-ads/poster  (POST, multipart)
// Fields: headline, subline, cta, details, style, format, count, productId?
// Files: product? (upload), logo? (upload)
// Generates a premium poster with the typography designed INTO the image, using
// the real product + logo as references (nano-banana-pro/edit).

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { designPoster, STYLE_GUIDE } from "@/lib/ai-ads/poster-director";
import { gptImageEdit, gptImageGenerate, chatGenerate } from "@/lib/ai-ads/chat-models";
import { FORMAT_IDS } from "@/lib/ai-ads/generate-image";

const BUCKET = "ad-studio";

async function uploadPng(
  admin: ReturnType<typeof supabaseAdmin>,
  accountId: string,
  file: File,
  prefix: string,
): Promise<string | null> {
  try {
    const png = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const path = `${prefix}/${accountId}/${randomUUID()}.png`;
    const up = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
    if (up.error) return null;
    return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const form = await req.formData();

    const headline = String(form.get("headline") ?? "").trim();
    const subline = String(form.get("subline") ?? "").trim();
    const cta = String(form.get("cta") ?? "").trim();
    const details = String(form.get("details") ?? "").trim();
    const style = String(form.get("style") ?? "").trim();
    const format = FORMAT_IDS.includes(String(form.get("format") ?? "")) ? String(form.get("format")) : "4:5";
    const count = Math.min(Math.max(Number(form.get("count")) || 1, 1), 3);
    const quality = (["standard", "hd", "best"] as const).includes(
      String(form.get("quality") ?? "") as "standard" | "hd" | "best",
    )
      ? (String(form.get("quality")) as "standard" | "hd" | "best")
      : "best";
    const gptQuality = quality === "standard" ? "low" : quality === "hd" ? "medium" : "high";
    const productId = String(form.get("productId") ?? "");
    const directives = String(form.get("directives") ?? "").trim().slice(0, 300);
    const wantBackdrop = String(form.get("backdrop")) === "1";

    if (!headline && !subline && !cta) {
      return NextResponse.json({ error: "Add at least a headline or some copy" }, { status: 400 });
    }

    // Resolve the product image: uploaded file wins, else the saved product.
    let productUrl: string | null = null;
    let productName: string | null = null;
    const productFile = form.get("product");
    if (productFile instanceof File && productFile.size) {
      productUrl = await uploadPng(admin, ctx.accountId, productFile, "poster-src");
    } else if (productId) {
      const { data: p } = await admin
        .from("ad_products")
        .select("name, ad_product_images(storage_path, is_primary)")
        .eq("id", productId)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (p) {
        productName = (p as { name: string }).name;
        const imgs = (p as { ad_product_images?: Array<{ storage_path: string; is_primary: boolean }> })
          .ad_product_images ?? [];
        const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
        if (primary) productUrl = admin.storage.from(BUCKET).getPublicUrl(primary.storage_path).data.publicUrl;
      }
    }

    // Resolve the logo: uploaded file (if any).
    let logoUrl: string | null = null;
    const logoFile = form.get("logo");
    if (logoFile instanceof File && logoFile.size) {
      logoUrl = (await uploadPng(admin, ctx.accountId, logoFile, "poster-logo")) ?? logoUrl;
    }
    if (String(form.get("noLogo")) === "1") logoUrl = null;

    // Optional 2-stage: generate a premium backdrop with a hero model first,
    // then composite the exact product + logo + text onto it.
    let backdropUrl: string | null = null;
    if (wantBackdrop) {
      try {
        const styleDesc = STYLE_GUIDE[style] ?? style ?? "premium";
        const bdPrompt = `An empty, ultra-premium advertising-poster background in a ${styleDesc} style${
          directives ? `, ${directives}` : ""
        }. Cinematic, photorealistic, rich depth and a refined colour grade, generous negative space with a clear central area to place a product. NO product, NO text, NO logo, NO watermark.`;
        const [bd] = await chatGenerate({ prompt: bdPrompt, format, model: "imagen4-ultra" });
        if (bd) {
          const bytes = new Uint8Array(await (await fetch(bd)).arrayBuffer());
          const path = `poster-src/${ctx.accountId}/${randomUUID()}.png`;
          const up = await admin.storage
            .from(BUCKET)
            .upload(path, bytes, { contentType: "image/png", upsert: true });
          if (!up.error) backdropUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
      } catch (e) {
        console.error("[ai-ads/poster] backdrop failed:", e);
      }
    }

    // Reference images in order, with a guide describing each (route owns ordering).
    const refs: Array<{ url: string; role: string }> = [];
    if (backdropUrl)
      refs.push({ url: backdropUrl, role: "the background scene/setting to build the poster on" });
    if (productUrl)
      refs.push({
        url: productUrl,
        role: `the product${productName ? ` ("${productName}")` : ""} — THE HERO; keep it photographically exact, never alter or redraw it`,
      });
    if (logoUrl)
      refs.push({ url: logoUrl, role: "the brand logo — place it tastefully (e.g. a corner), unaltered" });
    const imageUrls = refs.map((r) => r.url);
    const refGuide = refs.length
      ? refs.map((r, i) => `Reference image ${i + 1} is ${r.role}.`).join(" ")
      : "";

    const prompt = await designPoster({
      headline,
      subline,
      cta,
      details,
      productName,
      style,
      format,
      hasProduct: !!productUrl,
      hasLogo: !!logoUrl,
      refGuide,
      directives,
    });

    const { data: job } = await admin
      .from("ad_jobs")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        product_id: productId || null,
        type: "image",
        prompt: headline || cta || "Poster",
        brief: { prompt, headline, subline, cta },
        format,
        status: "processing",
        model: "poster",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;

    // Generate the posters with GPT image (full layout + crisp text) — num_images
    // returns `count` in one call. One inline retry for resilience.
    const runGpt = () =>
      imageUrls.length
        ? gptImageEdit({ prompt, imageUrls, format, quality: gptQuality, num: count })
        : gptImageGenerate({ prompt, format, quality: gptQuality, num: count });
    let candidates = await runGpt().catch((e) => {
      console.error("[ai-ads/poster] gen failed, retrying:", e);
      return [] as string[];
    });
    if (!candidates.length) candidates = await runGpt().catch(() => [] as string[]);
    console.log(
      `[ai-ads/poster] gpt-image | refs: ${refs.length} | count: ${count} | quality: ${gptQuality} → ${candidates.length}`,
    );
    const chosen = candidates.slice(0, count);

    // Persist each poster (GPT output is already crisp — no upscale needed).
    const results = await Promise.all(
      chosen.map(async (srcUrl, i) => {
        try {
          const bytes = new Uint8Array(await (await fetch(srcUrl)).arrayBuffer());
          const path = `outputs/${ctx.accountId}/${jobId}/${i}.png`;
          const up = await admin.storage
            .from(BUCKET)
            .upload(path, bytes, { contentType: "image/png", upsert: true });
          if (up.error) return null;
          const { data: asset } = await admin
            .from("ad_assets")
            .insert({
              account_id: ctx.accountId,
              job_id: jobId,
              type: "image",
              storage_path: path,
              variation_index: i,
              metadata: { model: "poster", prompt: headline || "Poster", format, premium: true },
            })
            .select("id")
            .single();
          return asset
            ? {
                id: asset.id as string,
                url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
                label: headline || "Poster",
                favorite: false,
              }
            : null;
        } catch (e) {
          console.error("[ai-ads/poster] finish failed:", e);
          return null;
        }
      }),
    );

    const assets = results.filter((a): a is NonNullable<typeof a> => !!a);
    await admin
      .from("ad_jobs")
      .update({ status: assets.length ? "completed" : "failed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (!assets.length) return NextResponse.json({ error: "Poster generation failed — try again" }, { status: 502 });
    return NextResponse.json({ assets });
  } catch (err) {
    return toErrorResponse(err);
  }
}
