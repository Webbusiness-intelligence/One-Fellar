// Skills — installable, selectable prompt RECIPES that shape generation (the
// "look / workflow"), distinct from Soul IDs (which lock the *subject*). Built-in
// skills are defined here; an account's CUSTOM skills live in the ad_skills table.
// A skill's recipe is folded into the director's instruction at generation time via
// skillAddendum(), so the output follows the skill. This module is pure (no server
// deps) so the composer can import the built-in list to render the picker.

export type SkillKind = "image" | "video" | "both";

export type SkillDefaults = {
  mood?: string;
  aspect?: string;
  quality?: "standard" | "hd" | "best";
  realism?: boolean;
  engine?: string;
};

export type Skill = {
  id: string; // "builtin:<slug>" or a uuid (custom)
  name: string;
  icon: string; // emoji
  kind: SkillKind;
  recipe: string; // style/director guidance, folded into the prompt
  negative?: string; // things to avoid
  defaults?: SkillDefaults;
  builtin?: boolean;
};

// Curated starter library. Recipes are written as director guidance — concrete
// lighting / lens / grade / texture cues so the look is reproducible.
export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "builtin:cinematic-commercial",
    name: "Cinematic Commercial",
    icon: "🎬",
    kind: "both",
    recipe:
      "Premium TV-commercial look: anamorphic 35mm lens, motivated three-point lighting with a soft key and a crisp rim, teal-and-amber colour grade, shallow depth of field, fine film grain, polished hero framing with deliberate negative space.",
    negative: "flat phone snapshot, harsh on-camera flash, muddy colour, cluttered frame",
    defaults: { quality: "best", realism: true },
  },
  {
    id: "builtin:ugc-authentic",
    name: "UGC / Authentic",
    icon: "📱",
    kind: "both",
    recipe:
      "Authentic user-generated social look: handheld phone camera, natural available light, candid slightly-imperfect framing, true-to-life skin and texture, a little motion and grain, honest unstyled colour — feels filmed by a real person, not a studio.",
    negative: "studio polish, cinematic grade, staged perfection, plastic over-smoothed skin",
    defaults: { realism: true },
  },
  {
    id: "builtin:editorial-beauty",
    name: "Editorial Beauty",
    icon: "💄",
    kind: "image",
    recipe:
      "High-fashion editorial beauty: 85mm f/1.8 close crop, soft clamshell / butterfly lighting, magazine colour grade, flawless yet real pore-level skin with subtle refined retouch, immaculate styling, clean negative space.",
    negative: "over-smoothed plastic skin, snapshot lighting, busy background, blown highlights",
    defaults: { quality: "best", realism: true },
  },
  {
    id: "builtin:hero-product",
    name: "Hero Product",
    icon: "📦",
    kind: "image",
    recipe:
      "Studio product hero: seamless sweep or premium surface, controlled soft-box lighting with clean crisp speculars, macro-sharp detail, physically accurate materials and label, a gentle grounding reflection, generous negative space for copy.",
    negative: "busy background, soft focus, colour cast, distorted or unreadable label",
    defaults: { quality: "best", realism: true },
  },
  {
    id: "builtin:golden-hour",
    name: "Golden Hour",
    icon: "🌅",
    kind: "both",
    recipe:
      "Warm golden-hour light: low sun backlight with a glowing rim, long soft shadows, gentle hazy lens bloom, an amber-honey palette, romantic natural warmth and atmosphere.",
    negative: "flat midday light, cool blue cast, hard ugly shadows, overcast grey",
    defaults: { realism: true },
  },
  {
    id: "builtin:noir",
    name: "Noir",
    icon: "🖤",
    kind: "both",
    recipe:
      "Dramatic film-noir: low-key chiaroscuro lighting, deep inky blacks, a single hard key source, high-contrast desaturated or monochrome grade, moody atmosphere with light haze or smoke.",
    negative: "flat even lighting, bright cheerful colour, low contrast, washed-out greys",
    defaults: { realism: true },
  },
  {
    id: "builtin:anime",
    name: "Anime",
    icon: "✨",
    kind: "image",
    recipe:
      "Polished anime illustration: clean cel-shaded line art, vibrant flat colour with soft gradients, expressive features, dynamic composition, studio-anime production quality.",
    negative: "photorealism, 3D render, muddy colours, messy linework",
    defaults: { realism: false },
  },
  {
    id: "builtin:product-3d",
    name: "3D Render",
    icon: "🧊",
    kind: "image",
    recipe:
      "Premium 3D CGI render: clean studio HDRI lighting, physically accurate PBR materials, soft global illumination, crisp reflections and contact shadows, polished commercial CGI finish.",
    negative: "photographic film grain, hand-drawn look, flat lighting, low-poly artefacts",
    defaults: { realism: false },
  },
];

export function getBuiltinSkill(id: string): Skill | undefined {
  return BUILTIN_SKILLS.find((s) => s.id === id);
}

// The text block folded into a director's instruction so the output follows the
// skill. Pass the chosen skill's name + recipe (+ optional negative).
export function skillAddendum(skill: Pick<Skill, "name" | "recipe" | "negative">): string {
  const neg = skill.negative ? ` Avoid: ${skill.negative}.` : "";
  return `Apply the "${skill.name}" skill — follow this look/recipe exactly: ${skill.recipe}${neg}`;
}
