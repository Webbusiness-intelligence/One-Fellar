# Genalot — Pre-Launch Test Plan

Work through this top to bottom. Every step says what to do and what you should see.
If a step fails, stop and note the exact error + the worker/Vercel log line.

---

## Step 0 — MUST DO before any testing (10 minutes)

### 0.1 Apply these migrations in Supabase → SQL Editor (in this order)

All three are re-runnable (safe to paste twice). **Without these, billing and Autopilot are broken:**

| # | File | Why it's critical |
|---|------|-------------------|
| 1 | `supabase/migrations/035_billing.sql` | **NOT applied** (probe confirmed). Without it the Paystack webhook 500s on every event — **payments never grant credits**. |
| 2 | `supabase/migrations/038_autopilot_refs.sql` | **NOT applied** (039/040 are, 038 was skipped). Without it **creating an Autopilot rule fails AND the worker tick can't read rules** — Autopilot is silently dead. |
| 3 | `supabase/migrations/041_ad_jobs_autopilot_type.sql` | New. Lets Autopilot posts charge credits. Until applied, posts run **unbilled** (worker logs a warning). |

### 0.2 Rotate the Ark API key (security)

The current key was pasted in chat twice. In the BytePlus ModelArk console: revoke it,
create a new one, update `ARK_API_KEY` on **Render** (worker) and Vercel if set there.

### 0.3 Confirm deploys are live

- **Vercel**: latest deploy = commit `980fdad` or newer (main).
- **Render worker**: service shows the same commit Live (branch `ad-studio-async-worker`).
  The worker picked up: ffmpeg-static, 50 MB transcode fallback, watermark fix,
  autopilot billing, 20-min render ceiling, Ark URL logging.

### 0.4 Env sanity on Render (worker)

`ARK_API_KEY` (new one), `USE_ARK_SEEDANCE=1`, `ARK_SEEDANCE_MODEL`,
`ARK_SEEDANCE_FAST_MODEL`, `FAL_KEY`, `GEMINI_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AYRSHARE_API_KEY`.

---

## 1 — Landing + Auth (5 min)

| # | Do | Expect |
|---|----|--------|
| 1.1 | Open `/` logged out | Marketing landing, hero, both 4K showcase clips autoplay; fullscreen button works |
| 1.2 | Click **Get started** → sign up with a NEW email | Account created, lands in the app |
| 1.3 | Log out → log in with that account | Works; wrong password shows an error (not a crash) |
| 1.4 | `/forgot-password` → submit your email | "Check your email" state; email arrives |
| 1.5 | While logged out, hit `/ad-studio` directly | Redirected to login |

## 2 — Free-tier limits (new account = free plan) (10 min)

| # | Do | Expect |
|---|----|--------|
| 2.1 | Create page: check the credit pill | 400 credits (free allotment) — if 0, the account bootstrap didn't grant; note it |
| 2.2 | Generate 1 image, standard quality | Renders; **Genalot watermark bottom-right** (new fix — verify!) |
| 2.3 | Try quality above Standard / variations > 2 | Clamped or blocked by plan gate |
| 2.4 | Video page: try 1080p or 4K | Clamped to 720p for free plan |
| 2.5 | Spend down to ~0 credits (or set `credit_balance=5` via SQL) then generate | Clean "out of credits" message (402), not a crash |

## 3 — Billing (Paystack TEST mode first) (15 min)

| # | Do | Expect |
|---|----|--------|
| 3.1 | Pricing page → pick Starter | Redirects to Paystack checkout (ZAR 349) |
| 3.2 | Pay with a Paystack test card | Redirect back to `/pricing?status=success` |
| 3.3 | Within ~30s check the credit pill + plan | Plan = starter, balance reset to 2,000 |
| 3.4 | Supabase → `billing_events` table | One row for the charge, `credits_granted` filled |
| 3.5 | Billing page | Shows plan, period end, ledger entries |
| 3.6 | Buy a credit pack | Balance increases by the pack amount (added, not reset) |
| 3.7 | Re-send the same webhook from Paystack dashboard | No double grant (idempotent) |

**Known caveat (decide before launch):** a plan renewal RESETS the balance to the plan
allotment — unused pack credits are wiped. If you want packs to survive renewal, that
needs a schema change; flag it if it matters to you.

## 4 — Create (images) as a PAID account (10 min)

| # | Do | Expect |
|---|----|--------|
| 4.1 | Generate with each model in the picker (1 image each, cheapest quality) | Each renders; credit cost differs per model and matches the button preview |
| 4.2 | Generate 4 variations | 4 images in the thread; **no watermark** (paid) |
| 4.3 | Upload a product photo + prompt an edit | Edit honours the source image |
| 4.4 | Type `@` in the composer | Soul picker appears; pick one; render includes the character |
| 4.5 | Refresh mid-generation | Pending message survives; result fills in when done (realtime) |

## 5 — Soul IDs (10 min)

| # | Do | Expect |
|---|----|--------|
| 5.1 | Soul page → create a **character** from text | Candidate sheet(s) render; pick + save |
| 5.2 | Create a **product** Soul from an uploaded photo | Reference sheet matches the product |
| 5.3 | Use `@handle` in Create | Character is consistent with the sheet |
| 5.4 | Use `@handle` in Video (see 6.4 caveat) | Reference-to-video path triggers |

## 6 — Video (the money feature) (20 min + render time)

| # | Do | Expect |
|---|----|--------|
| 6.1 | Seedance Fast, 5s, 720p, sound on, plain prompt (no refs, no start image) | Worker log shows `[ark] seedance ok … · task=… · url=…` (Ark text-to-video), clip lands in gallery |
| 6.2 | Same but **4K 15s** | Renders (≈6–8 min); if the file is >48 MB the log shows `oversized clip transcoded … MB → … MB` and the clip STILL lands (new fix — this exact case used to lose the render) |
| 6.3 | Check credits charged for 6.2 | ≈9× the 720p price (new 4K multiplier — the UI preview should match the charge) |
| 6.4 | Video with a photoreal-person Soul reference | Ark rejects ("real person") → falls back to fal → still renders. Watch for the fallback log line |
| 6.5 | Cinematic ON, 5s | Director rewrites the prompt; renders |
| 6.6 | Cuts mode, 10s | Multiple shots stitched (ffmpeg-static — first time this works on Render!) |
| 6.7 | Kling engine, 5s | Renders (fal) |

## 7 — Social / Planner / Autopilot (15 min)

| # | Do | Expect |
|---|----|--------|
| 7.1 | Social page → New post → schedule for +1h | Appears on calendar + day rail |
| 7.2 | Posts table (`/social/posts`) | Lists it with status |
| 7.3 | Autopilot page → create a rule (interval 1h, one platform, a Soul ref) | Rule saves (**fails before 038 is applied — that's the canary**) |
| 7.4 | Wait for the tick (≤60s past due) with 041 applied | Worker log: rule reserved + job runs; `scheduled_posts` row `posted`; credits deducted |
| 7.5 | Set account credits to 0, trigger a rule | Row = `failed` "insufficient credits"; no post |
| 7.6 | Ayrshare: check the post actually reached the platform | Visible on the connected account |

## 8 — Gallery + assets (5 min)

| # | Do | Expect |
|---|----|--------|
| 8.1 | Gallery shows images + videos incl. the rescued 4K boy clip | Plays inline; download works |
| 8.2 | Delete an asset | Gone after refresh |
| 8.3 | Upscale an image | Higher-res version appears |

## 9 — Settings + team (5 min)

| # | Do | Expect |
|---|----|--------|
| 9.1 | Change display name / avatar | Persists after refresh |
| 9.2 | Invite a teammate (studio plan) | Invite email + join flow works |

## 10 — Load + failure honesty (10 min)

| # | Do | Expect |
|---|----|--------|
| 10.1 | Queue 3 video jobs at once | Worker caps per-account concurrency (2); all finish |
| 10.2 | Kill the Render worker mid-render (redeploy) | Reaper requeues the stale job within ~15 min; user gets result or refund |
| 10.3 | Check `credit_ledger` after all tests | Every reserve has a matching settle or refund — no dangling reserves |

---

## Known non-blockers (accepted for launch)

- Jobs-route `kind=image` branch is dead code (Create goes via `/api/ai-ads/chat`).
- Renewal wipes pack credits (see 3, decide policy).
- Settle refunds the ~1-credit Gemini routing overhead on image jobs (immaterial).
- Supabase free tier caps uploads at 50 MB — long 4K clips get transcoded to fit
  (~46 MB, visually identical). Upgrading Supabase removes the cap.
