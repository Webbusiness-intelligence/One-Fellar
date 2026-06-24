// The "Director": turns a product + a user prompt into N distinct ad
// SCENE concepts. We deliberately ask Gemini to describe only the
// background/environment — the product itself is preserved and composited
// in by the image model, so the Director must not re-describe it (that's
// how product drift creeps in).

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export interface AdScene {
  label: string;
  scene: string;
}

export async function directAdScenes(opts: {
  productName: string;
  productDescription?: string | null;
  prompt: string;
  count: number;
}): Promise<AdScene[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const { productName, productDescription, prompt, count } = opts;

  const instruction = `You are an expert advertising creative director.
Product: "${productName}".${productDescription ? ` Product details: ${productDescription}.` : ""}
The user's creative brief: "${prompt}".

Produce ${count} DISTINCT ad scene concepts. For each, "scene" is a vivid,
PREMIUM, photorealistic description of the BACKGROUND / ENVIRONMENT the product
will be composited into — surface, setting, props, colour palette, and mood —
written like a pro photographer's brief: include the lighting setup
(direction/quality/softness), a camera + lens and depth of field, intentional
composition, fine surface/material micro-detail, and tasteful color grading.
End each scene with "sharp focus, professional photography, high detail, natural
color grading". Do NOT describe the product itself; it is preserved and placed
in automatically. Do NOT invent logos or text.

Return STRICT JSON only:
{"scenes":[{"label":"<3-5 word name>","scene":"<scene description>"}]}
with exactly ${count} items.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as { scenes?: Array<{ label?: string; scene?: string }> };

  const scenes = (parsed.scenes ?? [])
    .slice(0, count)
    .map((s) => ({ label: String(s.label ?? "Ad"), scene: String(s.scene ?? "") }))
    .filter((s) => s.scene.length > 0);

  if (scenes.length === 0) throw new Error("Director returned no usable scenes");
  return scenes;
}
