// Aesthetic scorer for best-of-N: a vision-LLM rates each candidate's overall
// quality (composition, lighting, realism, appeal) and we keep the best one —
// "taste built in." Fail-open: returns the first candidate on any error.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function toBase64(url: string): Promise<string> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf.toString("base64");
}

async function scoreOne(url: string): Promise<number> {
  try {
    const data = await toBase64(url);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Rate this advertising image's overall aesthetic quality — composition, lighting, realism, polish and visual appeal — from 0 to 10. Return STRICT JSON only: {\"score\": <number>}.",
                },
                { inline_data: { mime_type: "image/png", data } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const score = Number((JSON.parse(text) as { score?: number }).score);
    return Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
  } catch {
    return 0;
  }
}

export async function pickBestAesthetic(urls: string[]): Promise<string> {
  if (urls.length <= 1 || !GEMINI_API_KEY) return urls[0];
  const scores = await Promise.all(urls.map(scoreOne));
  let bestIdx = 0;
  let best = -1;
  scores.forEach((s, i) => {
    if (s > best) {
      best = s;
      bestIdx = i;
    }
  });
  return urls[bestIdx];
}
