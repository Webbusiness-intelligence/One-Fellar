// Run async work with bounded concurrency so we don't fire a big burst of fal
// calls at once (which trips rate limits and makes batches come back short).

export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker),
  );
  return results;
}

// Retry an image call a few times with backoff; returns the URL or null.
export async function withRetry(
  fn: () => Promise<string[]>,
  tries = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const out = await fn();
      if (out[0]) return out[0];
    } catch (e) {
      console.error("[ai-ads] generation attempt failed:", e);
    }
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  return null;
}
