"use client";

// Skill picker for the composers — select an installable look/recipe (built-in or
// custom) that the director applies, and create your own. Shared by Create + Video.
import { useEffect, useState } from "react";
import { Wand2, Plus, Trash2, X, Check, Loader2 } from "lucide-react";

import { BUILTIN_SKILLS, type Skill } from "@/lib/ai-ads/skills";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  kind?: "image" | "video";
};

export function SkillPicker({ value, onChange, kind = "image" }: Props) {
  const [custom, setCustom] = useState<Skill[]>([]);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✨");
  const [recipe, setRecipe] = useState("");
  const [negative, setNegative] = useState("");

  useEffect(() => {
    fetch("/api/ai-ads/skills")
      .then((r) => r.json())
      .then((j) => setCustom((j.custom ?? []) as Skill[]))
      .catch(() => {});
  }, []);

  const all = [...BUILTIN_SKILLS, ...custom].filter((s) => s.kind === "both" || s.kind === kind);
  const selected = all.find((s) => s.id === value) ?? null;

  const create = async () => {
    if (!name.trim() || !recipe.trim()) {
      setErr("Name and recipe are required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/ai-ads/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, recipe, negative, kind: "both" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't save");
      const sk = j.skill as Skill;
      setCustom((xs) => [sk, ...xs]);
      onChange(sk.id);
      setCreateOpen(false);
      setName("");
      setRecipe("");
      setNegative("");
      setIcon("✨");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setCustom((xs) => xs.filter((s) => s.id !== id));
    if (value === id) onChange(null);
    await fetch(`/api/ai-ads/skills/${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Skill — an installable look/recipe applied to your generation"
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors hover:border-white/25 ${
          selected
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-white/10 bg-white/5 text-foreground/80 hover:text-foreground"
        }`}
      >
        <Wand2 className="size-3.5" />
        {selected ? `${selected.icon} ${selected.name}` : "Skill"}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-white/5 ${
                !value ? "text-primary" : "text-foreground/80"
              }`}
            >
              None
              {!value ? <Check className="size-3.5" /> : null}
            </button>
            {all.map((s) => (
              <div key={s.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-white/5 ${
                    value === s.id ? "text-primary" : "text-foreground/80"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  {value === s.id ? <Check className="size-3.5" /> : null}
                </button>
                {!s.builtin ? (
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    title="Delete skill"
                    className="px-1.5 text-muted-foreground opacity-0 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-2.5 py-2 text-left text-[13px] text-foreground/80 hover:bg-white/5"
            >
              <Plus className="size-3.5" /> New skill
            </button>
          </div>
        </>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">New skill</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={2}
                  aria-label="Icon"
                  className="w-12 rounded-lg border border-border bg-background px-2 py-2 text-center text-sm outline-none"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Skill name (e.g. Brand Look)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
                />
              </div>
              <textarea
                value={recipe}
                onChange={(e) => setRecipe(e.target.value)}
                rows={4}
                placeholder="Describe the look / recipe — lighting, lens, colour grade, texture, composition…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
              />
              <input
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                placeholder="Avoid (optional) — e.g. plastic skin, harsh flash"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
              />
              {err ? <p className="text-[12px] text-red-400">{err}</p> : null}
              <button
                type="button"
                onClick={create}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save skill
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
