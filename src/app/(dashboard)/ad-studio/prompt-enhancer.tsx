"use client";

// Enhance button + modal — runs the AI director (no generation) and shows the FULL
// prompt that will be sent to the model. Editable for images & single-shot video
// (the render then uses your exact text); read-only for cut sequences. Shared by the
// Create + Video composers.
import { useState } from "react";
import { Wand2, X, Copy, Check, Loader2 } from "lucide-react";

export type EnhanceParams = {
  kind: "image" | "video";
  prompt: string;
  mood?: string;
  aspect?: string;
  soulIds?: string[];
  skillId?: string | null;
  engine?: string;
  duration?: number;
  cuts?: boolean;
};

export function PromptEnhancer({
  getParams,
  onUse,
  className,
}: {
  getParams: () => EnhanceParams;
  onUse: (r: { prompt: string; keyframe?: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [keyframe, setKeyframe] = useState<string | undefined>(undefined);
  const [editable, setEditable] = useState(true);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    const p = getParams();
    setOpen(true);
    setErr(null);
    if (!p.prompt.trim()) {
      setErr("Type a prompt first.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/ai-ads/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const j = (await r.json()) as { prompt?: string; keyframe?: string; editable?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error || "Couldn't enhance");
      setText(j.prompt || "");
      setKeyframe(j.keyframe);
      setEditable(j.editable !== false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't enhance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        title="Enhance — preview & edit the full director prompt sent to the model"
        className={
          className ??
          "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-foreground/80 transition-colors hover:border-white/25 hover:text-foreground"
        }
      >
        <Wand2 className="size-3.5" />
        Enhance
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Wand2 className="size-4 text-primary" /> Enhanced prompt
                {!editable ? <span className="text-[11px] font-normal text-muted-foreground">· cut sequence (read-only)</span> : null}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">
              The full prompt the AI director sends to the model
              {editable ? " — edit it and it's used exactly as written." : ". Cuts render per-shot, so this is read-only."}
            </p>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Directing…
              </div>
            ) : err ? (
              <p className="py-6 text-sm text-red-400">{err}</p>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => editable && setText(e.target.value)}
                  readOnly={!editable}
                  rows={14}
                  className="w-full flex-1 resize-none rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-primary/40"
                />
                <div className="mt-1 text-right text-[11px] text-muted-foreground/60">
                  {text.length.toLocaleString()} chars
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground/80 hover:text-foreground"
                  >
                    {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />} Copy
                  </button>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => {
                        onUse({ prompt: text, keyframe });
                        setOpen(false);
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
                    >
                      Use this prompt
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
