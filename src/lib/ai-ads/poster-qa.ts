// Poster QA — borrowed from the chat/quick evaluator idea, tuned for posters.
// A vision-LLM scores each candidate on (1) TEXT correctness/legibility — the #1
// poster killer is garbled or misspelled copy — and (2) design quality, then we
// keep the highest composite. Fail-open: returns the first candidate on error.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

async function toBase64(url: string): Promise<string> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf.toString("base64");
}

async function scoreOne(
  url: string,
  copy: { headline?: string; subline?: string; cta?: string },
): Promise<number> {
  try {
    const data = await toBase64(url);
    const want = [
      copy.headline && `headline "${copy.headline}"`,
      copy.subline && `subheadline "${copy.subline}"`,
      copy.cta && `call to action "${copy.cta}"`,
    ]
      .filter(Boolean)
      .join(", ");
    const instruction = `You are a strict advertising-poster QA reviewer.
This poster is meant to contain exactly this copy: ${want || "(no specific copy)"}.
Score two things from 0 to 10:
- "textCorrect": is ALL visible text spelled correctly, complete and legible, with NO garbled/duplicated/missing letters or invented words? (10 = flawless, 0 = gibberish)
- "design": overall premium design quality — composition, typography, hierarchy, polish.
Return STRICT JSON only: {"textCorrect": <0-10>, "design": <0-10>}.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }, { inline_data: { mime_type: "image/png", data } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(text) as { textCorrect?: number; design?: number };
    const t = Math.max(0, Math.min(10, Number(p.textCorrect) || 0));
    const d = Math.max(0, Math.min(10, Number(p.design) || 0));
    // Weight text correctness heavily — a beautiful poster with garbled text is unusable.
    return t * 0.65 + d * 0.35;
  } catch {
    return 0;
  }
}

export async function pickBestPoster(
  urls: string[],
  copy: { headline?: string; subline?: string; cta?: string },
): Promise<string> {
  if (urls.length <= 1 || !GEMINI_API_KEY) return urls[0];
  const scores = await Promise.all(urls.map((u) => scoreOne(u, copy)));
  let best = 0;
  let bestIdx = 0;
  scores.forEach((s, i) => {
    if (s > best) {
      best = s;
      bestIdx = i;
    }
  });
  return urls[bestIdx];
}
