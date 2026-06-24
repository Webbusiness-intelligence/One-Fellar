// Poster Director: turns the user's content + product + logo + brand into ONE
// award-studio-grade generation prompt for an EXPENSIVE-looking poster, with the
// typography designed INTO the image. The named design-language library is what
// makes results look premium and varied instead of generic. Gemini.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

// Each key maps to a rich art-direction descriptor (a real design language).
export const STYLE_GUIDE: Record<string, string> = {
  "luxury-editorial":
    "luxury fashion-editorial design language (Vogue / Harper's Bazaar): refined serif display type, vast negative space, a restrained sophisticated palette, elegant and aspirational mood, subtle film grain",
  swiss:
    "Swiss / International Typographic style: a precise asymmetric grid, clean grotesque sans-serif, bold scale contrast, photography-driven, rational and confident",
  "art-deco":
    "Art Deco luxury: bold symmetrical geometry, metallic gold accents, strong vertical emphasis, elegant capitalised display type, opulent and glamorous",
  brutalist:
    "refined brutalist: oversized raw typography, a stark high-contrast grid, intentional tension, elevated by a luxury colour palette",
  cinematic:
    "cinematic editorial: moody dramatic lighting, a teal-and-orange colour grade, deep shadows, filmic atmosphere, premium movie-poster feel",
  organic:
    "organic Kinfolk lifestyle: warm natural light, an airy minimal layout, a muted earthy palette, soft authentic mood, generous whitespace",
  streetwear:
    "bold streetwear / hype: an energetic graphic layout, heavy condensed type, high-contrast colour pops, sticker and tag accents, youthful confidence",
  "tech-minimal":
    "Apple-keynote tech-minimal: a clean gradient backdrop, the product as hero under soft studio light, sleek thin-to-bold type, abundant space, futuristic restraint",
  vintage:
    "vintage print craft: a retro colour palette, halftone and film grain, classic condensed type, nostalgic poster feel",
  maximalist:
    "premium maximalist: a rich layered composition, bold expressive type, a vivid but considered palette, collage depth, gallery-grade craft",
};

export async function designPoster(opts: {
  headline?: string;
  subline?: string;
  cta?: string;
  details?: string;
  productName?: string | null;
  brandName?: string | null;
  brandColors?: string[];
  brandFonts?: string | null;
  brandNotes?: string | null;
  style?: string; // a STYLE_GUIDE key, or a free description
  format: string;
  hasProduct: boolean;
  hasLogo: boolean;
  refGuide?: string; // describes each reference image in order (route owns ordering)
  directives?: string; // camera / angle / lighting art-direction to honour
}): Promise<string> {
  const styleDesc = (opts.style && STYLE_GUIDE[opts.style]) || opts.style || STYLE_GUIDE["luxury-editorial"];
  const copy = [
    opts.headline && `headline "${opts.headline}"`,
    opts.subline && `subheadline "${opts.subline}"`,
    opts.cta && `call to action "${opts.cta}"`,
  ]
    .filter(Boolean)
    .join(", ");

  const fallback = `An expensive-looking, award-winning advertising poster (${opts.format} aspect) in a ${styleDesc} design language. ${
    opts.hasProduct ? "Feature the product from the first reference image as the hero, kept photographically exact. " : ""
  }${
    opts.hasLogo ? "Place the brand logo from the reference image tastefully in a corner, unaltered. " : ""
  }Integrate this text, rendered crisply and correctly spelled with refined typography: ${copy}. ${
    opts.details ?? ""
  } A confident type system with one oversized hero element and strong scale contrast, one clear focal point, generous negative space, a deliberate restrained palette${
    opts.brandColors?.length ? ` built around ${opts.brandColors.join(", ")}` : ""
  }, subtle film grain and a refined colour grade. Magazine print quality. Avoid any generic, templated or stock-photo look. Correct spelling, no gibberish.`;

  if (!GEMINI_API_KEY) return fallback;

  const instruction = `You are an award-winning art director at a top studio (D&AD / Cannes Lions calibre).
Design an EXPENSIVE-LOOKING advertising poster (aspect ${opts.format}) — gallery-grade, never generic or templated.
DESIGN LANGUAGE: ${styleDesc}.
Integrate this exact copy, rendered crisply and CORRECTLY SPELLED with refined typography:
${opts.headline ? `- Headline: "${opts.headline}"` : ""}
${opts.subline ? `- Subheadline: "${opts.subline}"` : ""}
${opts.cta ? `- Call to action: "${opts.cta}"` : ""}
${opts.details ? `Extra details / offer: ${opts.details}` : ""}
${opts.refGuide ?? ""}
${opts.directives ? `Camera & lighting direction to honour exactly: ${opts.directives}.` : ""}
${opts.brandName ? `Brand: "${opts.brandName}".` : ""} ${opts.brandColors?.length ? `Brand colours: ${opts.brandColors.join(", ")}.` : ""} ${opts.brandFonts ? `Typography preference: ${opts.brandFonts}.` : ""} ${opts.brandNotes ? `Brand voice: ${opts.brandNotes}.` : ""}

Apply premium craft:
- TYPOGRAPHY: a confident type system — ONE oversized hero element, strong scale contrast, refined kerning and tracking, at most two complementary typefaces, intentional alignment.
- COMPOSITION: one clear focal point, asymmetric balance, rule-of-thirds placement, and GENEROUS negative space — let it breathe; space signals luxury.
- COLOUR: a deliberate, restrained palette grounded in colour theory; tasteful contrast.
- PHOTOGRAPHY: shoot the product / hero like a high-end campaign — a flattering lens with shallow depth of field, premium commercial lighting (e.g. soft studio softbox, dramatic Rembrandt, or rim / back light), true-to-life materials, reflections and fine micro-texture.
- FINISH: subtle film grain / fine texture, gentle depth and shadow, a refined cinematic colour grade — magazine print quality.
AVOID at all costs: a generic stock-photo or clipart look, cluttered layouts, defaulting to centred-everything, cheap gradients, filler text, gibberish or misspelled words.
CRITICAL: spell ALL text exactly as given; keep every line legible.
SAFE FRAME: keep the whole composition inside the frame with comfortable margins — every headline, line of copy, the logo and the CTA must be FULLY visible and must NOT touch the edges, be cropped or bleed off the poster.
Return ONLY the final prompt as one paragraph — no preamble, labels or quotes.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { temperature: 0.9 },
        }),
      },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
    return text.length > 40 ? text : fallback;
  } catch (e) {
    console.error("[ai-ads] designPoster failed:", e);
    return fallback;
  }
}
