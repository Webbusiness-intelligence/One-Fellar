// /api/ai-ads/soul
//   GET  — list the account's Soul IDs (reusable @handle assets)
//   POST — create one (multipart). Three sources:
//     source=prompt : generate a multi-view reference sheet from `description`
//     source=upload : register an uploaded image directly (file field `source`)
//     source=chat   : save an existing generated image (field `sourceUrl`)
//   Fields: name, kind (character|product|location|prop|style), description?, handle?, source

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gptImageEdit, gptImageGenerate } from "@/lib/ai-ads/chat-models";

const BUCKET = "ad-studio";
const KINDS = ["character", "product", "location", "prop", "style"];

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "asset"
  );
}

// Reference-sheet prompt per kind (mirrors the commercial Asset Studio so a Soul
// ID reads identically wherever it's used).
function soulSheetPrompt(kind: string, desc: string, hasRef: boolean): { prompt: string; format: string } {
  const ref = hasRef
    ? " Reproduce the subject in the reference image EXACTLY (same identity, form, colours, label, proportions); do not restyle or replace it."
    : "";
  switch (kind) {
    case "product":
      return {
        format: "1:1",
        prompt: `Technical PRODUCT reference sheet of ${desc}, shown in four views in a clean 2x2 grid — front, back, top-down, and 3/4 angle — isolated on a neutral light-grey background, sharp even studio lighting, photorealistic materials and textures, ultra high resolution. Thin grey dividers between views only. NO text, NO labels, NO callouts.${ref}`,
      };
    case "character":
      return {
        format: "16:9",
        prompt: `CHARACTER reference sheet: two panels side by side on a neutral grey studio background — LEFT a full-body standing view, RIGHT a head-and-shoulders close-up — of ${desc}. Identical identity, face, hair and wardrobe across both panels, photorealistic, soft even studio light, 35mm film look. NO text, NO labels.${ref}`,
      };
    case "location":
      return {
        format: "16:9",
        prompt: `Cinematic LOCATION plate: an empty establishing wide shot of ${desc}. Anamorphic lens look, fine film grain, premium colour grade, deep focus, generous negative space. NO people, NO product, NO text — just the environment, ready to place subjects into.${ref}`,
      };
    case "style":
      return {
        format: "1:1",
        prompt: `A STYLE / mood board that captures the visual language of ${desc} — colour palette, lighting, texture and composition cues arranged as a cohesive reference. Photoreal where relevant, premium art direction. NO text, NO labels, NO watermarks.${ref}`,
      };
    default:
      return {
        format: "1:1",
        prompt: `PROP reference of ${desc}, shown from a few clean angles, isolated on a neutral grey background, photorealistic, sharp studio lighting, high detail. NO text, NO labels.${ref}`,
      };
  }
}

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("ad_soul_ids")
      .select("id, handle, name, kind, source, storage_path, created_at")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false });
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
    const items = (data ?? []).map((r) => ({
      id: r.id,
      handle: r.handle,
      name: r.name,
      kind: r.kind,
      source: r.source,
      url: pub(r.storage_path as string),
    }));
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (p: string) => admin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const kind = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : "character";
    const description = String(form.get("description") ?? "").trim().slice(0, 600);
    const source = ["prompt", "upload", "chat"].includes(String(form.get("source")))
      ? String(form.get("source"))
      : "prompt";
    // GPT image model + quality tier. gpt-image-2 is the latest; 1.5 keeps the
    // low|medium|high (Standard|HD|Best) tiers.
    const gptModel: "gpt-image-1.5" | "gpt-image-2" =
      String(form.get("model")) === "gpt-image-2" ? "gpt-image-2" : "gpt-image-1.5";
    const quality = (["low", "medium", "high"] as const).includes(
      String(form.get("quality")) as "low" | "medium" | "high",
    )
      ? (String(form.get("quality")) as "low" | "medium" | "high")
      : "high";
    // How many variations to generate for a prompt (>1 → return candidates to pick).
    const count = Math.min(Math.max(Number(form.get("count")) || 1, 1), 6);
    // Existing Soul IDs @-referenced in the description — fed as reference images.
    let soulRefIds: string[] = [];
    try {
      const r = JSON.parse(String(form.get("soulIds") ?? "[]"));
      if (Array.isArray(r)) soulRefIds = r.filter((x) => typeof x === "string").slice(0, 4);
    } catch {
      /* ignore */
    }
    if (!name) return NextResponse.json({ error: "Give it a name" }, { status: 400 });

    // Resolve the reference image as PNG bytes, by source.
    let bytes: Uint8Array | null = null;
    if (source === "upload") {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size)
        return NextResponse.json({ error: "Upload an image" }, { status: 400 });
      bytes = new Uint8Array(
        await sharp(Buffer.from(await file.arrayBuffer()))
          .rotate()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer(),
      );
    } else if (source === "chat") {
      const srcUrl = String(form.get("sourceUrl") ?? "");
      if (!srcUrl) return NextResponse.json({ error: "Missing image" }, { status: 400 });
      bytes = new Uint8Array(await (await fetch(srcUrl)).arrayBuffer());
    } else {
      // prompt → generate a reference sheet (optionally guided by an uploaded ref).
      if (!description)
        return NextResponse.json({ error: "Describe what to create" }, { status: 400 });
      let refUrl: string | null = null;
      const refFile = form.get("file");
      if (refFile instanceof File && refFile.size) {
        const png = await sharp(Buffer.from(await refFile.arrayBuffer()))
          .rotate()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        const p = `soul-src/${ctx.accountId}/${randomUUID()}.png`;
        const up = await admin.storage.from(BUCKET).upload(p, png, { contentType: "image/png", upsert: true });
        if (!up.error) refUrl = pub(p);
      }
      // Collect reference images: the uploaded one + any @-referenced Soul IDs.
      const refUrls: string[] = [];
      if (refUrl) refUrls.push(refUrl);
      if (soulRefIds.length) {
        const { data: refSouls } = await admin
          .from("ad_soul_ids")
          .select("storage_path")
          .in("id", soulRefIds)
          .eq("account_id", ctx.accountId);
        for (const s of refSouls ?? []) refUrls.push(pub(s.storage_path as string));
      }
      const { prompt, format } = soulSheetPrompt(kind, description, refUrls.length > 0);
      let outs: string[] = [];
      try {
        outs = refUrls.length
          ? await gptImageEdit({ prompt, imageUrls: refUrls, format, quality, num: count, model: gptModel })
          : await gptImageGenerate({ prompt, format, quality, num: count, model: gptModel });
      } catch (e) {
        console.error("[ai-ads/soul] gen failed:", e);
      }
      if (!outs.length)
        return NextResponse.json({ error: "Couldn't generate that — try again" }, { status: 502 });
      // Multiple variations → let the client pick which one becomes the Soul ID
      // (saved via a follow-up source=chat call with the chosen URL).
      if (count > 1) {
        console.log(`[ai-ads/soul] ${outs.length} candidates for "${name}" (${kind})`);
        return NextResponse.json({ candidates: outs });
      }
      bytes = new Uint8Array(await (await fetch(outs[0])).arrayBuffer());
    }

    // Store the reference image.
    const path = `soul/${ctx.accountId}/${randomUUID()}.png`;
    const upI = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upI.error) throw upI.error;

    // Unique @handle per account (slug of the name, suffixed if taken).
    let handle = String(form.get("handle") ?? "").trim();
    handle = handle ? slugify(handle) : slugify(name);
    const { data: existing } = await admin
      .from("ad_soul_ids")
      .select("handle")
      .eq("account_id", ctx.accountId);
    const taken = new Set((existing ?? []).map((r) => String(r.handle).toLowerCase()));
    if (taken.has(handle)) {
      let n = 2;
      while (taken.has(`${handle}-${n}`)) n++;
      handle = `${handle}-${n}`;
    }

    const { data: row, error } = await admin
      .from("ad_soul_ids")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        handle,
        name,
        kind,
        description: description || null,
        storage_path: path,
        source,
      })
      .select("id, handle, name, kind, source")
      .single();
    if (error) throw error;

    console.log(`[ai-ads/soul] created @${handle} (${kind}, ${source}) for ${ctx.accountId}`);
    return NextResponse.json({ soul: { ...row, url: pub(path) } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
