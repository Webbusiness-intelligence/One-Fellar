// Fidelity evaluator: a vision-LLM (Gemini) compares the ORIGINAL product to a
// generated ad and judges whether the product is faithfully preserved — same
// shape/colour/label, and crucially NO invented logos or text. Used by the
// generate route to auto-retry editing-model output that drifts.
//
// Fail-open by design: any API/parse error returns a "pass" so the evaluator
// can never block a generation that already succeeded.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface FidelityResult {
  pass: boolean;
  score: number;
  issues: string;
}

const PASS: FidelityResult = { pass: true, score: 10, issues: "" };

async function toBase64(input: string | Uint8Array): Promise<string> {
  const buf =
    typeof input === "string"
      ? Buffer.from(await (await fetch(input)).arrayBuffer())
      : Buffer.from(input);
  return buf.toString("base64");
}

export async function evaluateFidelity(opts: {
  productUrl: string;
  generated: Uint8Array;
  productName: string;
}): Promise<FidelityResult> {
  if (!GEMINI_API_KEY) return PASS;
  try {
    const [productB64, genB64] = await Promise.all([
      toBase64(opts.productUrl),
      toBase64(opts.generated),
    ]);

    const instruction = `You are a strict product-ad QA checker.
Image 1 is the ORIGINAL product "${opts.productName}" (the reference).
Image 2 is an AI-generated ad that should feature the SAME product.
Judge ONLY product fidelity: is it the same product — same shape, colour, label text and logo — with NO invented or extra logos, text, or graphics that are not on the original?
Ignore background, lighting, camera angle and styling differences; those are expected and fine.
Return STRICT JSON only:
{"score": <integer 0-10, how faithful the product is>, "pass": <true only if score>=7 AND no invented logo/text>, "issues": "<short phrase naming any drift, or empty string>"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: instruction },
                { inline_data: { mime_type: "image/png", data: productB64 } },
                { inline_data: { mime_type: "image/png", data: genB64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (!res.ok) return PASS;

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(text) as { score?: number; pass?: boolean; issues?: string };
    const score = Math.max(0, Math.min(10, Math.round(Number(p.score) || 0)));
    return { pass: p.pass === true, score, issues: String(p.issues ?? "") };
  } catch (e) {
    console.error("[ai-ads] fidelity evaluation failed (non-fatal):", e);
    return PASS;
  }
}
