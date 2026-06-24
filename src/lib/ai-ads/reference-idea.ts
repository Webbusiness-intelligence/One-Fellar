// Vision helpers for the conversational studio.
//  - readReferenceIdea: distils a reference ad's CREATIVE IDEA (mood/strategy) so we
//    can invent fresh, completely different ads in its spirit — never copying pixels.
//  - describeProduct: identifies the hero product in one specific phrase so generated
//    concepts feature THAT product and don't morph it into something else.
// Both fail-open (return "") so generation never blocks.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

type Part = { text?: string; inline_data?: { mime_type: string; data: string } };

async function imageParts(urls: string[]): Promise<Part[]> {
  const parts: Part[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
    } catch {
      /* skip unreadable images */
    }
  }
  return parts;
}

async function ask(parts: Part[], temperature: number): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature } }),
      },
    );
    if (!res.ok) return "";
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch (e) {
    console.error("[ai-ads] vision call failed (non-fatal):", e);
    return "";
  }
}

export async function readReferenceIdea(opts: { imageUrls: string[] }): Promise<string> {
  if (!GEMINI_API_KEY || !opts.imageUrls.length) return "";
  const parts = await imageParts(opts.imageUrls);
  if (!parts.length) return "";
  parts.push({
    text: `You are an elite advertising creative director studying reference ad(s) for INSPIRATION only.
Look past the literal background, props and layout — do NOT describe them to be copied.
Instead, extract the underlying CREATIVE IDEA so a team can produce fresh, completely different ads in the same spirit:
- the emotional hook and the feeling it sells
- the brand positioning / who it's for
- the mood, energy and aesthetic sensibility
- the visual language and colour/lighting feeling (as a vibe, not a literal scene)
Return 2-4 sentences of pure creative direction — an idea brief, not a description of this exact image. No preamble.`,
  });
  return ask(parts, 0.8);
}

export async function describeProduct(opts: { imageUrls: string[] }): Promise<string> {
  if (!GEMINI_API_KEY || !opts.imageUrls.length) return "";
  const parts = await imageParts(opts.imageUrls);
  if (!parts.length) return "";
  parts.push({
    text: `Identify the product in the image(s) in ONE short, specific phrase so it can be reproduced faithfully in new ads.
Include its category/type, brand (if visible), form/shape and signature features — e.g. "a glass Coca-Cola contour bottle with the red Original Taste label" or "a matte-black wireless over-ear headphone".
Return only the phrase, no preamble.`,
  });
  return ask(parts, 0.2);
}
