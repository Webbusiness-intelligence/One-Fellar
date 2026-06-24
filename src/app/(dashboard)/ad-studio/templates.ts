// Curated ad templates — one-click starting points for non-designers. Each
// prefills the chat composer with a prompt scaffold (edit the [your product]
// placeholder). The router still picks the model/aspect from the text.

export type Template = { id: string; label: string; desc: string; prompt: string };
export type TemplateGroup = { category: string; items: Template[] };

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    category: "Format",
    items: [
      {
        id: "ig-feed",
        label: "Instagram feed",
        desc: "1:1 square post",
        prompt:
          "A polished Instagram feed ad, 1:1 square, for [your product] — clean composition, on-brand, with space for a short headline.",
      },
      {
        id: "story",
        label: "Story / Reel",
        desc: "9:16 vertical",
        prompt:
          "A vertical 9:16 story ad for [your product] — bold and thumb-stopping, with room for a punchy headline near the top.",
      },
      {
        id: "fb-ad",
        label: "Facebook ad",
        desc: "1:1 feed ad",
        prompt:
          "A Facebook feed ad for [your product], 1:1, with a clear product focus and a strong value proposition.",
      },
      {
        id: "wide-banner",
        label: "Wide banner",
        desc: "16:9 hero",
        prompt:
          "A wide 16:9 banner ad for [your product] — cinematic and premium, with the headline space on one side.",
      },
    ],
  },
  {
    category: "Occasion",
    items: [
      {
        id: "black-friday",
        label: "Black Friday",
        desc: "Big discount",
        prompt:
          "A high-energy Black Friday sale poster for [your product] with bold 'BLACK FRIDAY' text and a big discount call-out.",
      },
      {
        id: "launch",
        label: "Product launch",
        desc: "Introducing…",
        prompt:
          "A sleek product-launch announcement for [your product] — an 'Introducing' hero shot, premium and minimal.",
      },
      {
        id: "flash-sale",
        label: "Flash sale",
        desc: "Urgent, 9:16",
        prompt:
          "A vibrant flash-sale story (9:16) for [your product] with an urgent 'LIMITED TIME' headline.",
      },
      {
        id: "festive",
        label: "Festive / holiday",
        desc: "Seasonal",
        prompt:
          "A warm festive holiday ad for [your product] with cozy seasonal styling and a gift-ready feel.",
      },
    ],
  },
  {
    category: "Style",
    items: [
      {
        id: "minimal-studio",
        label: "Minimal studio",
        desc: "Clean backdrop",
        prompt:
          "A minimal studio product shot of [your product] on a seamless backdrop, soft shadows, lots of negative space.",
      },
      {
        id: "lifestyle",
        label: "Lifestyle",
        desc: "In real use",
        prompt:
          "A natural lifestyle scene featuring [your product] in real use, golden-hour light, authentic and aspirational.",
      },
      {
        id: "luxury",
        label: "Luxury editorial",
        desc: "Premium feel",
        prompt:
          "A luxury editorial ad for [your product] — premium materials, dramatic lighting, elegant and aspirational.",
      },
      {
        id: "ugc-selfie",
        label: "UGC selfie",
        desc: "Authentic",
        prompt:
          "A UGC-style selfie photo of a person holding [your product], iPhone-style framing, casual and authentic.",
      },
    ],
  },
];
