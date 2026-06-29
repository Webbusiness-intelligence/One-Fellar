// /api/ai-ads/chat
//   GET  → list the account's chats
//   POST → send a message (multipart: text, chatId?, files[]) → routed image reply
//
// Synchronous: route the request (Gemini) → run the image model → persist a
// lightweight job + assets → store user + assistant messages → return the reply.

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { routeChat } from "@/lib/ai-ads/router";
import { planTurn } from "@/lib/ai-ads/agent";
import { FORMAT_IDS } from "@/lib/ai-ads/generate-image";
import { chatCredits, planLimits, clampQuality } from "@/lib/ai-ads/cost";
import { directImage } from "@/lib/ai-ads/image-director";
import { resolveSkill } from "@/lib/ai-ads/resolve-skill";
import { skillAddendum } from "@/lib/ai-ads/skills";

const BUCKET = "ad-studio";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const { data, error } = await ctx.supabase
      .from("ad_chats")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ chats: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole("agent");
    const admin = supabaseAdmin();
    const pub = (path: string) => admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const form = await req.formData();
    const text = String(form.get("text") ?? "").trim();
    let chatId = (form.get("chatId") as string) || null;
    let variations = Math.min(Math.max(Number(form.get("variations")) || 1, 1), 12);
    let quality = (["standard", "hd", "best"] as const).includes(
      String(form.get("quality") ?? "") as "standard" | "hd" | "best",
    )
      ? (String(form.get("quality")) as "standard" | "hd" | "best")
      : "standard";
    // Free-tier gating (server-authoritative): cap quality + variations to the plan.
    const { data: planRow } = await admin
      .from("accounts")
      .select("plan")
      .eq("id", ctx.accountId)
      .maybeSingle();
    const plan = (planRow?.plan as string) ?? "free";
    quality = clampQuality(plan, quality);
    variations = Math.min(variations, planLimits(plan).maxVariations);
    // GPT image is the engine everywhere now (kept silent in the UI); nano stays as
    // a reachable fallback only if explicitly requested.
    const engine = String(form.get("engine") ?? "gpt") === "nano" ? "nano" : "gpt";
    const fmtRaw = String(form.get("format") ?? "");
    const format = FORMAT_IDS.includes(fmtRaw) ? fmtRaw : null;
    const directives = String(form.get("directives") ?? "")
      .trim()
      .slice(0, 400);
    let productIds: string[] = [];
    try {
      const r = JSON.parse(String(form.get("productIds") ?? "[]"));
      if (Array.isArray(r)) productIds = r.filter((x) => typeof x === "string").slice(0, 5);
    } catch {
      /* ignore */
    }
    const refAssetId = String(form.get("refAssetId") ?? "");
    const styleAssetId = String(form.get("styleAssetId") ?? "");
    let soulIds: string[] = [];
    try {
      const r = JSON.parse(String(form.get("soulIds") ?? "[]"));
      if (Array.isArray(r)) soulIds = r.filter((x) => typeof x === "string").slice(0, 4);
    } catch {
      /* ignore */
    }
    // Photographic realism director (default on) — enriches plain-image prompts with
    // the realism playbook; off = the user's raw prompt (good for graphics/illustration).
    const realism = String(form.get("realism") ?? "true") !== "false";
    const mood = String(form.get("mood") ?? "auto").slice(0, 40);
    const skillId = String(form.get("skillId") ?? "").trim() || null;
    const enhancedPrompt = String(form.get("enhancedPrompt") ?? "").trim();
    const anyFile =
      ["products", "references"].some((k) =>
        form.getAll(k).some((f) => f instanceof File && (f as File).size > 0),
      ) || (form.get("logo") instanceof File && (form.get("logo") as File).size > 0);
    if (!text && !anyFile && !productIds.length && !refAssetId && !styleAssetId && !soulIds.length) {
      return NextResponse.json({ error: "Type a message" }, { status: 400 });
    }

    // Ensure a chat exists.
    if (!chatId) {
      const { data: chat, error } = await admin
        .from("ad_chats")
        .insert({
          account_id: ctx.accountId,
          created_by: ctx.userId,
          title: text.slice(0, 60) || "New chat",
        })
        .select("id")
        .single();
      if (error) throw error;
      chatId = chat.id as string;
    }

    // Normalise an upload to PNG and return its public URL.
    const uploadImage = async (f: File): Promise<string | null> => {
      try {
        const png = await sharp(Buffer.from(await f.arrayBuffer()))
          .rotate()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        const path = `chat/${ctx.accountId}/${chatId}/${randomUUID()}.png`;
        const up = await admin.storage
          .from(BUCKET)
          .upload(path, png, { contentType: "image/png", upsert: true });
        return up.error ? null : pub(path);
      } catch (e) {
        console.error("[ai-ads/chat] upload failed:", e);
        return null;
      }
    };

    // Role-labelled references: edit base (modify it), products (kept EXACT), logo,
    // style/scene references.
    type Ref = {
      url: string;
      role: "product" | "logo" | "reference" | "edit" | "soul";
      label?: string;
      kind?: string;
    };
    const refs: Ref[] = [];

    for (const f of form
      .getAll("products")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, 5)) {
      const u = await uploadImage(f);
      if (u) refs.push({ url: u, role: "product" });
    }
    if (productIds.length) {
      const { data: pimgs } = await admin
        .from("ad_product_images")
        .select("product_id, storage_path, is_primary")
        .in("product_id", productIds)
        .eq("account_id", ctx.accountId);
      for (const pid of productIds) {
        const imgs = (pimgs ?? []).filter((i) => i.product_id === pid);
        const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
        if (primary) refs.push({ url: pub(primary.storage_path), role: "product" });
      }
    }
    if (refAssetId) {
      const { data: a } = await admin
        .from("ad_assets")
        .select("storage_path")
        .eq("id", refAssetId)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (a) refs.push({ url: pub(a.storage_path), role: "edit" });
    }
    const logoFile = form.get("logo");
    if (logoFile instanceof File && logoFile.size) {
      const u = await uploadImage(logoFile);
      if (u) refs.push({ url: u, role: "logo" });
    }
    for (const f of form
      .getAll("references")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, 4)) {
      const u = await uploadImage(f);
      if (u) refs.push({ url: u, role: "reference" });
    }
    if (styleAssetId) {
      const { data: a } = await admin
        .from("ad_assets")
        .select("storage_path")
        .eq("id", styleAssetId)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (a) refs.push({ url: pub(a.storage_path), role: "reference" });
    }
    // @-referenced Soul IDs — both explicit picks (soulIds) AND any @handle typed in
    // the message — composed into the image as named subjects (a character as itself,
    // a location as the setting, a product as the product), kept accurate.
    const soulHandleMatches = [...text.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase());
    const soulNameByHandle: Record<string, string> = {};
    if (soulIds.length || soulHandleMatches.length) {
      const { data: souls } = await admin
        .from("ad_soul_ids")
        .select("id, handle, name, kind, storage_path")
        .eq("account_id", ctx.accountId);
      const chosen = (souls ?? []).filter(
        (s) =>
          soulIds.includes(s.id as string) ||
          soulHandleMatches.includes(String(s.handle).toLowerCase()),
      );
      for (const s of chosen.slice(0, 4)) {
        soulNameByHandle[String(s.handle).toLowerCase()] = String(s.name);
        refs.push({
          url: pub(s.storage_path as string),
          role: "soul",
          label: String(s.name),
          kind: String(s.kind),
        });
      }
    }

    await admin.from("ad_chat_messages").insert({
      account_id: ctx.accountId,
      chat_id: chatId,
      role: "user",
      text,
      attachments: refs.map((r) => r.url),
    });

    // Context: recent history + the most recent assistant image (for edits).
    const { data: recent } = await admin
      .from("ad_chat_messages")
      .select("role, text, asset_ids")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(8);
    const history = (recent ?? [])
      .slice()
      .reverse()
      .map((m) => `${m.role}: ${m.text || (m.role === "assistant" ? "[image]" : "")}`)
      .join("\n");

    let prevImageUrl: string | null = null;
    for (const m of recent ?? []) {
      const ids = (m.asset_ids as string[]) ?? [];
      if (m.role === "assistant" && ids.length) {
        const { data: a } = await admin
          .from("ad_assets")
          .select("storage_path")
          .eq("id", ids[ids.length - 1])
          .maybeSingle();
        if (a) {
          prevImageUrl = pub(a.storage_path);
          break;
        }
      }
    }

    // Conversational layer: decide whether to talk or generate, and what to say.
    const plan = await planTurn({
      text,
      hasRefs: refs.length > 0,
      refRoles: refs.map((r) => r.role),
      hasPreviousImage: !!prevImageUrl,
      history,
    });

    // Words-only turn (a question / advice / brainstorm with nothing attached to
    // spend) — reply in text, no image generation.
    if (!plan.generate && refs.length === 0) {
      const msg = plan.message || "Tell me what you'd like to create and I'll get started.";
      const { data: am } = await admin
        .from("ad_chat_messages")
        .insert({
          account_id: ctx.accountId,
          chat_id: chatId,
          role: "assistant",
          text: msg,
          metadata: { suggestions: plan.suggestions },
        })
        .select("id")
        .single();
      await admin.from("ad_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
      return NextResponse.json({
        chatId,
        message: {
          id: am?.id,
          role: "assistant",
          text: msg,
          assets: [],
          suggestions: plan.suggestions,
        },
      });
    }

    const decision = await routeChat({
      text,
      attachmentCount: refs.length,
      hasPreviousImage: !!prevImageUrl,
      history,
    });

    const aspect = format ?? decision.aspect;
    // No new references but a follow-up edit → keep & modify the previous image.
    if (!refs.length && decision.action === "edit" && prevImageUrl) {
      refs.push({ url: prevImageUrl, role: "edit" });
    }
    const hasRefs = refs.length > 0;
    const conceptBase = directives
      ? `${decision.prompt}. Art direction to honour exactly: ${directives}`
      : decision.prompt;
    // Create is a general image generator, not an ad maker — only build a text /
    // poster layout when the user actually asks for it (or attaches a logo).
    const wantsText =
      /["“”].+["“”]/.test(text) ||
      /\b(ads?|advert\w*|poster|banner|flyer|billboard|headline|sub-?head\w*|caption|tagline|slogan|text|typograph\w*|copy|cta|call[\s-]?to[\s-]?action|sale|discount|promo\w*|%\s?off|title|says|wording|logo|brand\w*)\b/i.test(
        text,
      ) ||
      refs.some((r) => r.role === "logo");

    let usedPrompt = decision.prompt;
    let genModel: string = decision.model;
    let failed = false;
    try {
      if (engine === "gpt") {
        // GPT image engine (via fal). Default = a clean photographic image of the
        // prompt (no text); only builds a magazine-style text/poster layout when
        // wantsText. References are passed directly (like ChatGPT) — subject kept
        // accurate, reference as style inspiration. num_images returns N in one call.
        genModel = "gpt-image-1.5";
        const gptQuality = quality === "standard" ? "low" : quality === "hd" ? "medium" : "high";
        const guide = refs.length
          ? " " +
            refs
              .map((r, i) => {
                const n = i + 1;
                if (r.role === "edit")
                  return `Image ${n} is the CURRENT design — apply ONLY the requested change to it and keep everything else (product, layout, text, colours) exactly the same.`;
                if (r.role === "product")
                  return `Image ${n} is the PRODUCT — make it the hero and keep it accurate (its form, label and branding intact).`;
                if (r.role === "logo")
                  return `Image ${n} is the brand LOGO — include it tastefully and unaltered.`;
                if (r.role === "soul")
                  return `Image ${n} is ${r.label ?? "a saved asset"}${
                    r.kind ? ` (the ${r.kind})` : ""
                  } — feature it in the scene EXACTLY as shown, keeping it accurate and recognisable${
                    r.kind === "location" ? "; use it as the actual setting/background" : ""
                  }.`;
                return `Image ${n} is a REFERENCE — take inspiration from its style, composition and mood; do NOT copy it.`;
              })
              .join(" ")
          : "";
        const isEditTurn = refs.some((r) => r.role === "edit");
        const safeMargins =
          " Keep the full subject comfortably within the frame — nothing important cropped or bleeding off the edges.";
        const adSafeFrame =
          " Keep the entire composition inside the frame with comfortable safe margins — every headline, word of copy, the logo and the call-to-action must be FULLY visible and must NOT touch the edges, be cropped, or bleed off the frame.";
        // Photographic realism: the director rewrites the plain-image prompt with the
        // realism playbook (real skin, film grade, motivated light, lens) — adapting to
        // the mood and honouring non-photo styles. Skipped for edits and text/posters.
        // A selected SKILL (look/recipe) is folded into the director and applies even
        // when realism is off (e.g. an anime/3D skill).
        const realismApplies = realism && !isEditTurn && !wantsText;
        const skill =
          skillId && !isEditTurn && !wantsText ? await resolveSkill(admin, skillId, ctx.accountId) : null;
        const useDirector = (realismApplies || !!skill) && !enhancedPrompt;
        let conceptForGpt = conceptBase;
        if (useDirector) {
          const cleanText = text.replace(
            /@([a-zA-Z0-9_-]+)/g,
            (_, h: string) => soulNameByHandle[h.toLowerCase()] ?? h,
          );
          const soulSubjects = refs
            .filter((r) => r.role === "soul")
            .map((r) => ({ tag: r.label ?? "", desc: r.label ?? "", kind: r.kind ?? "" }));
          conceptForGpt = await directImage({
            prompt: cleanText,
            mood,
            aspect,
            subjects: soulSubjects.length ? soulSubjects : undefined,
            skill: skill ? skillAddendum(skill) : undefined,
          });
        }
        usedPrompt = enhancedPrompt
          ? `${enhancedPrompt}${guide}${safeMargins}`
          : isEditTurn
          ? `${conceptBase}.${guide} Preserve the existing layout, subject, colours and any existing text exactly — change ONLY what was asked.${safeMargins}`
          : wantsText
            ? `${conceptBase}.${guide} Design a complete, premium, magazine-quality advertisement: ` +
              `a strong headline with supporting copy, a tasteful logo and call-to-action, clean professional typography and a polished, balanced layout. Render all text crisply and correctly.${adSafeFrame}`
            : useDirector
              ? `${conceptForGpt}${guide}${safeMargins}`
              : `${conceptBase}.${guide} Render a single, clean, photorealistic image of exactly this. Do NOT add any text, headline, caption, logo, watermark, label, border, UI or graphic-design overlay — produce a pure image, not a poster or ad.${safeMargins}`;
        const n = Math.min(variations, 8);
        // Use GPT Image 2 (the top model) when composing @-referenced Soul IDs — far
        // stronger multi-subject adherence — OR when the user picks Best quality, so a
        // plain prompt at Best gets the most realistic skin/detail the ladder offers.
        const gptModel =
          refs.some((r) => r.role === "soul") || quality === "best"
            ? ("gpt-image-2" as const)
            : undefined;
        if (gptModel) genModel = gptModel;
        // === ASYNC: the reasoning is done; enqueue the resolved render for the worker
        // (no 1–3 min held request) and return a pending assistant message. The worker
        // (worker/run-image, resolved mode) fills in this message when it finishes. ===
        const { data: pending } = await admin
          .from("ad_chat_messages")
          .insert({
            account_id: ctx.accountId,
            chat_id: chatId,
            role: "assistant",
            text: "Generating…",
            asset_ids: [],
            metadata: { pending: true, model: gptModel ?? genModel, aspect, suggestions: plan.suggestions },
          })
          .select("id")
          .single();
        const assistantMsgId = pending!.id as string;
        const est = chatCredits({ variations: n, quality, isEdit: isEditTurn, engine: "gpt" });
        const { data: jid, error: enqErr } = await admin.rpc("reserve_and_enqueue", {
          acct: ctx.accountId,
          creator: ctx.userId,
          est,
          payload: {
            resolvedPrompt: usedPrompt,
            model: gptModel ?? "gpt-image-1.5",
            quality,
            num: n,
            refUrls: refs.map((r) => r.url),
            aspect,
            chatId,
            assistantMsgId,
            summary: decision.prompt,
          },
          jtype: "image",
          fmt: "1:1",
        });
        if (enqErr) {
          const broke = /insufficient_credits/i.test(enqErr.message);
          const txt = broke
            ? "You're out of credits — top up to generate."
            : "Couldn't start the render — please try again.";
          await admin
            .from("ad_chat_messages")
            .update({ text: txt, metadata: { error: true } })
            .eq("id", assistantMsgId);
          return NextResponse.json(
            { chatId, jobId: null, message: { id: assistantMsgId, role: "assistant", text: txt, assets: [], error: true } },
            { status: broke ? 402 : 500 },
          );
        }
        await admin.from("ad_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
        return NextResponse.json({
          chatId,
          jobId: jid,
          message: { id: assistantMsgId, role: "assistant", text: "Generating…", assets: [], pending: true },
        });
      }
    } catch (e) {
      failed = true;
      console.error("[ai-ads/chat] generation failed:", e);
    }

      const txt = failed
        ? "Something went wrong making that image — try again."
        : "I couldn't make that one. Try rephrasing it?";
      const { data: am } = await admin
        .from("ad_chat_messages")
        .insert({
          account_id: ctx.accountId,
          chat_id: chatId,
          role: "assistant",
          text: txt,
          metadata: { error: true },
        })
        .select("id")
        .single();
      await admin.from("ad_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
      return NextResponse.json({
        chatId,
        message: { id: am?.id, role: "assistant", text: txt, assets: [], error: true },
      });
  } catch (err) {
    return toErrorResponse(err);
  }
}
