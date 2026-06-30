// Ayrshare social posting (Phase 1: single profile = your own connected accounts,
// API key only). Phase 2 adds per-customer User Profiles + JWT linking (needs the
// private key on a paid plan). Docs: https://docs.ayrshare.com
const KEY = process.env.AYRSHARE_API_KEY ?? "";
const BASE = "https://api.ayrshare.com/api";

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
}

// The networks currently linked to the Ayrshare account (e.g. ["instagram","tiktok"]).
export async function listConnected(): Promise<string[]> {
  if (!KEY) throw new Error("AYRSHARE_API_KEY is not set");
  const res = await fetch(`${BASE}/user`, { headers: headers() });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || "Ayrshare /user failed");
  return Array.isArray(j.activeSocialAccounts) ? (j.activeSocialAccounts as string[]) : [];
}

// Post (or schedule) to the given platforms. scheduleDate (ISO-8601 UTC, future) makes
// Ayrshare hold + post it at that time — so we don't need our own timing engine.
export async function postToSocial(opts: {
  post: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduleDate?: string;
}): Promise<{ id?: string; status: string }> {
  if (!KEY) throw new Error("AYRSHARE_API_KEY is not set");
  const body: Record<string, unknown> = { post: opts.post, platforms: opts.platforms };
  if (opts.mediaUrls?.length) body.mediaUrls = opts.mediaUrls;
  if (opts.scheduleDate) body.scheduleDate = opts.scheduleDate;

  const res = await fetch(`${BASE}/post`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok || j.status === "error") {
    const detail = j.message || (Array.isArray(j.errors) ? j.errors.map((e: { message?: string }) => e.message).join("; ") : "");
    throw new Error(detail || "Ayrshare post failed");
  }
  return { id: j.id ?? j.postIds?.[0]?.id, status: j.status ?? "success" };
}
