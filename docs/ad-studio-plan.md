# Ad Studio — AI Product-Ad Generator (build plan)

A new module inside Awtoads (this Next.js 16 + Supabase app) that turns a product
+ a prompt into finished ads — images, video, and UGC avatar clips. "Higgsfield in
your own app."

> Status: planning → Phase 1. Director runs on **Gemini**. Models via **fal.ai**.

## Guiding principle: orchestrate, don't train

Higgsfield raised $130M+ and trained a multi-billion-parameter diffusion-transformer
on B200 clusters — but their *ad product* is an **orchestration + agent layer** on top
of best-in-class models (Nano Banana for images, Seedance/Kling for video, Soul for
avatars), chained by a "Hermes" reasoning engine. We build that orchestration layer.
We do **not** train a foundation model.

The hard problem is **keeping the real product identical** (logo, colours, shape,
label text). We solve it with product-preserving *editing* models, not generic
text-to-image.

## Pipeline

```
Product (upload images OR paste URL → scrape)
  → background-removal → clean cutout                 [Bria RMBG via fal]
Prompt + format + style
  → DIRECTOR (Gemini): prompt + product → structured creative brief
      { scene, lighting, camera, mood, copy, format, variations[] }
  → IMAGE: product-preserving model                   [Bria Product Shot / Nano Banana / Seedream]
  → (Phase 4) EVALUATOR vision-LLM: fidelity check → retry until pass
  → (Phase 2) VIDEO: image→video                      [Seedance / Kling / Veo]
  → (Phase 3) UGC: avatar + lip-sync
Gallery of variations → pick → export per platform size
```

## Model stack (all via fal.ai aggregator)

| Job | Model | ~Cost |
|---|---|---|
| Background removal | Bria RMBG | low |
| Product-in-scene image | **Bria Product Shot** (commercially licensed/safe, keeps product intact) | ~$0.04/img |
| Richer scenes / multi-ref | Nano Banana (Gemini image), Seedream 4 | ~$0.03/img |
| Director / Evaluator | **Gemini 3** | tokens |
| Image→video | Seedance 2.0 / Kling / Veo 3 | $0.05–0.40/s |
| Avatars + lip-sync | (Phase 3 — TBD: Soul-style / HeyGen / fal avatar) | per clip |

Economics: image ad ≈ $0.03–0.07; 5s video ≈ $0.25–2.00. Strong margins.
Commercial safety: prefer licensed models (Bria) for output users will publish.

## Async architecture (the hard part)

Generation takes 10–120s, so never block a request:

1. Create an `ad_jobs` row (`status=queued`)
2. Call fal in **queue mode with a webhook**
3. fal calls back `POST /api/ai-ads/webhook` → store assets, flip status
4. Client watches via **Supabase Realtime** → results stream into the gallery live

## Data model (Supabase, account-scoped RLS — reuses the accounts model)

- `ad_products` — name, description, brand_colors (jsonb), source_url
- `ad_product_images` — original + cutout storage paths, is_primary
- `ad_jobs` — product_id, prompt, brief (jsonb), type (image|video|ugc), format,
  status, model, error
- `ad_assets` — job_id, type, storage_path, variation_index, score, metadata (jsonb)
- Storage bucket `ad-studio` (`products/`, `outputs/`)

All rows carry `account_id`; RLS mirrors existing account-scoped tables.

## App structure

- Sidebar: new **Ad Studio** entry (`src/components/layout/sidebar.tsx` → `navItems`)
- `src/app/(dashboard)/ad-studio/` — products grid + "New product"
- `src/app/(dashboard)/ad-studio/[productId]/` — generate ads + live gallery
- `src/app/api/ai-ads/webhook/route.ts` — fal callback
- `src/lib/ai-ads/` — `director.ts`, `generate-image.ts`, `generate-video.ts`,
  `avatars.ts`, `bg-removal.ts`, `scrape.ts`, `fal-client.ts`
- Env: `FAL_KEY`, `GEMINI_API_KEY` (in `.env.local`)

## Phases (full is the destination; each phase ships value)

1. **Image ads** ⭐ — product upload + URL scrape → cutout → Director → product-in-scene
   images → gallery + export. Sellable on its own.
2. **Video ads** — image→video, 9:16 / 16:9 / 1:1.
3. **UGC avatars** — avatar picker + script → talking-head / unboxing / try-on, lip-synced.
4. **Polish & moat** — evaluator self-correction loop, A/B variations, credits/billing,
   preference-learning on user picks (the part that improves automatically over time).

## Fidelity tiers ("training our AI")

- **Tier 0 (v1):** prompt-engineered Director + product-preserving editing models. No training.
- **Tier 1 (later):** per-product LoRA (fal Flux.2 trainer, 15–30 imgs) for hero items.
- **Tier 2 (moat):** DPO-style preference learning on which ad users pick.
- **Tier 3 (only at scale):** fine-tune a base model. Not now.

## References

- Higgsfield AI Ad Generator — https://higgsfield.ai/ai-ad-generator
- Higgsfield training (Nebius case study) — https://nebius.com/customer-stories/higgsfield-ai
- Bria Product Shot API — https://fal.ai/models/fal-ai/bria/product-shot
- ID-preservation (arXiv) — https://arxiv.org/html/2404.04828v1
- Compound-AI ad pipeline (arXiv) — https://arxiv.org/html/2605.16748
- Model comparison — https://melies.co/compare/ai-image-models
- fal pricing — https://pricepertoken.com/image
