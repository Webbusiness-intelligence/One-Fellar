// Thin wrapper over the fal.ai synchronous run endpoint. Phase 1 runs
// image generation inline (Bria Product Shot is fast); video/queue+webhook
// comes in a later phase. Server-only — never import from a client component.

const FAL_KEY = process.env.FAL_KEY;

export async function falRun<T>(model: string, input: unknown, timeoutMs = 75000): Promise<T> {
  if (!FAL_KEY) throw new Error("FAL_KEY is not configured");
  // Bound each call so one slow/hung model can't stall the whole request
  // (e.g. the parallel "compare" flow). On abort, callers' per-model catch
  // turns it into a graceful failure for that model only.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`fal ${model} ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Queue-based runner for long jobs (video). Submits to the fal queue, then polls
// the status/response URLs until the render completes. Server-only.
export async function falQueue<T>(
  model: string,
  input: unknown,
  opts?: { pollMs?: number; timeoutMs?: number },
): Promise<T> {
  if (!FAL_KEY) throw new Error("FAL_KEY is not configured");
  const pollMs = opts?.pollMs ?? 5000;
  const timeoutMs = opts?.timeoutMs ?? 600000; // 10 min ceiling
  const headers = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" };

  const sub = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!sub.ok) throw new Error(`fal queue ${model} ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  const { status_url, response_url } = (await sub.json()) as {
    status_url: string;
    response_url: string;
  };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st = await fetch(status_url, { headers });
    if (!st.ok) continue;
    const s = (await st.json()) as { status?: string };
    if (s.status === "COMPLETED") {
      const res = await fetch(response_url, { headers });
      if (!res.ok) throw new Error(`fal queue result ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return (await res.json()) as T;
    }
    if (s.status === "FAILED" || s.status === "ERROR")
      throw new Error(`fal queue ${model} failed to render`);
  }
  throw new Error(`fal queue ${model} timed out`);
}
