// Voiceover writer: turns the commercial's storyline into a premium spoken VO
// script timed to the film length. Returns ONLY the words to be spoken.
// Fail-open: returns "" on any error (stitch then skips VO).

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

export async function writeVoiceover(opts: {
  storyline: string;
  bible?: string;
  brief?: string;
  duration: number; // seconds
}): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const words = Math.max(8, Math.round(opts.duration * 2.3)); // ~2.3 spoken words/sec

  const instruction = `You are an award-winning advertising copywriter writing the VOICEOVER for a ${opts.duration}-second premium commercial.
Write it to be SPOKEN over the film — about ${words} words total (it must comfortably fit ${opts.duration}s at a natural, unhurried pace).
Make it feel like a $1,000,000 brand film: a confident, warm, evocative narration that rides the story's emotional arc and lands on a memorable closing line / call-to-action.
Story it narrates: ${opts.storyline}
${opts.bible ? `Product/brand: ${opts.bible}` : ""}
${opts.brief ? `Brief: ${opts.brief}` : ""}
Return ONLY the spoken words — no quotation marks, no labels, no stage directions, no scene numbers.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { temperature: 0.85 },
        }),
      },
    );
    if (!res.ok) return "";
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch (e) {
    console.error("[ai-ads] writeVoiceover failed (non-fatal):", e);
    return "";
  }
}
