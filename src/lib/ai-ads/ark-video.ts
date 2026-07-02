// Seedance 2.0 via Ark DIRECT (BytePlus ModelArk / Volcengine) — a cheaper path than
// fal for the same ByteDance model. OPT-IN: only used when USE_ARK_SEEDANCE=1 AND
// ARK_API_KEY is set, so the working fal path is unaffected until you flip the flag.
//
// Ark uses an async task API: POST creates a task → returns { id }; you then poll
// GET .../tasks/{id} until status="succeeded" and read content.video_url.
// Docs: https://docs.byteplus.com/en/docs/ModelArk/1520757
//
// Env (set on the WORKER — Render — and optionally Vercel; NEVER commit the key):
//   ARK_API_KEY               — your Ark secret (ark-…). Required.
//   USE_ARK_SEEDANCE=1        — flip Seedance renders from fal → Ark.
//   ARK_BASE_URL              — default BytePlus intl host below; for Volcengine CN use
//                               https://ark.cn-beijing.volces.com
//   ARK_SEEDANCE_MODEL        — versioned model id from your console's "API call guide"
//   ARK_SEEDANCE_FAST_MODEL   — the fast variant's model id

const KEY = process.env.ARK_API_KEY;
const BASE = (process.env.ARK_BASE_URL || "https://ark.ap-southeast.bytepluses.com").replace(/\/+$/, "");
const MODEL = process.env.ARK_SEEDANCE_MODEL || "dreamina-seedance-2-0-260128";
const FAST_MODEL = process.env.ARK_SEEDANCE_FAST_MODEL || "dreamina-seedance-2-0-fast-260128";

const POLL_MS = 6000;
const TIMEOUT_MS = 600_000;

export function arkSeedanceEnabled(): boolean {
  return !!KEY && process.env.USE_ARK_SEEDANCE === "1";
}

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role: string };

// Render a Seedance clip on Ark. Handles image-to-video (first/last frame) and
// reference-to-video (up to 9 reference images), matching the fal callers.
export async function arkSeedanceVideo(opts: {
  prompt: string;
  duration: number; // 4-15
  resolution?: string; // 480p | 720p | 1080p | 2k | 4k
  audio?: boolean;
  fast?: boolean;
  ratio?: string; // e.g. 16:9, 9:16, adaptive
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
}): Promise<string | null> {
  if (!KEY) return null;

  const content: ContentItem[] = [{ type: "text", text: opts.prompt }];
  if (opts.firstFrameUrl) content.push({ type: "image_url", image_url: { url: opts.firstFrameUrl }, role: "first_frame" });
  if (opts.lastFrameUrl) content.push({ type: "image_url", image_url: { url: opts.lastFrameUrl }, role: "last_frame" });
  for (const u of (opts.referenceUrls ?? []).slice(0, 9)) {
    content.push({ type: "image_url", image_url: { url: u }, role: "reference_image" });
  }

  const body = {
    model: opts.fast ? FAST_MODEL : MODEL,
    content,
    resolution: (opts.resolution ?? "720p").toLowerCase(),
    // "adaptive" makes the clip follow the first frame's aspect; otherwise 16:9.
    ratio: opts.ratio ?? (opts.firstFrameUrl ? "adaptive" : "16:9"),
    duration: Math.min(Math.max(Math.round(opts.duration), 4), 15),
    generate_audio: opts.audio !== false,
  };

  const create = await fetch(`${BASE}/api/v3/contents/generations/tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = (await create.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
    message?: string;
  };
  if (!create.ok || !created.id) {
    throw new Error(`Ark create failed (${create.status}): ${created.error?.message || created.message || "no task id"}`);
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${BASE}/api/v3/contents/generations/tasks/${created.id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const j = (await res.json().catch(() => ({}))) as {
      status?: string;
      content?: { video_url?: string } | Array<{ video_url?: string }>;
      video_url?: string;
      usage?: { total_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    if (j.status === "succeeded") {
      // Ark bills by tokens — surface the REAL ByteDance usage per render in the logs.
      console.log(
        `[ark] seedance ok · model=${body.model} · ${body.resolution} · ${body.duration}s · usage=${
          j.usage?.total_tokens ?? "?"
        } tokens`,
      );
      return (Array.isArray(j.content) ? j.content[0]?.video_url : j.content?.video_url) ?? j.video_url ?? null;
    }
    if (j.status === "failed" || j.status === "expired" || j.status === "cancelled") {
      throw new Error(`Ark task ${j.status}: ${j.error?.message || "generation failed"}`);
    }
  }
  throw new Error("Ark task timed out");
}
