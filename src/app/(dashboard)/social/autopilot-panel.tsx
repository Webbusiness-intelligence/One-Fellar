"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Power, Trash2, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface Rule {
  id: string;
  name: string;
  prompt: string;
  caption: string;
  platforms: string[];
  interval_hours: number;
  next_run_at: string;
  active: boolean;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FREQ = [
  { label: "Daily", hours: 24 },
  { label: "Every 3 days", hours: 72 },
  { label: "Weekly", hours: 168 },
];
const cadence = (h: number) =>
  h === 24 ? "Daily" : h === 72 ? "Every 3 days" : h === 168 ? "Weekly" : `Every ${Math.round(h / 24)}d`;

export function AutopilotPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Autopilot");
  const [prompt, setPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [hours, setHours] = useState(168);
  const [startAt, setStartAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const r = await fetch("/api/social/autopilot");
    const j = await r.json();
    if (r.ok) setRules(j.rules ?? []);
  }
  useEffect(() => {
    load();
    fetch("/api/social/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []))
      .catch(() => {});
  }, []);

  const toggle = (p: string) =>
    setPlatforms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  async function create() {
    setErr("");
    if (!prompt.trim()) return setErr("Describe what to generate.");
    if (!platforms.length) return setErr("Pick at least one platform.");
    setBusy(true);
    try {
      const r = await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, caption, platforms, intervalHours: hours, startAt: startAt || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't create.");
      setOpen(false);
      setPrompt("");
      setCaption("");
      setPlatforms([]);
      setStartAt("");
      load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  async function setRuleActive(id: string, active: boolean) {
    await fetch(`/api/social/autopilot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/social/autopilot/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Zap className="h-4 w-4 text-primary" /> Autopilot
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:border-primary/40"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">
        Auto-generate a fresh image and post it on a repeating schedule.
      </p>

      {open && (
        <div className="mb-4 rounded-xl border border-border bg-background p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="What to generate each time (e.g. a minimalist product shot of my serum on wet marble)"
            className="mb-2 w-full resize-none rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="mb-2 flex flex-wrap gap-1.5">
            {accounts.length ? (
              accounts.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    platforms.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {title(p)}
                </button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Connect accounts first.</span>
            )}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
            >
              {FREQ.map((f) => (
                <option key={f.hours} value={f.hours}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className="text-xs text-muted-foreground">
              Start
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="ml-1 rounded-md border border-input bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
          {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      {rules.length ? (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {cadence(r.interval_hours)} · {r.platforms.map(title).join(", ")} · next{" "}
                  {new Date(r.next_run_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setRuleActive(r.id, !r.active)}
                title={r.active ? "Pause" : "Resume"}
                className={cn("rounded-md p-1.5", r.active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <Power className="h-4 w-4" />
              </button>
              <button onClick={() => remove(r.id)} title="Delete" className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No autopilots yet.</p>
      )}
    </div>
  );
}
