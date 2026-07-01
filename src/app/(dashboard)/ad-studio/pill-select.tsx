"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";

// A pill dropdown that opens UPWARD with its own logic — native <select> popups are
// unreliable inside the glass (backdrop-blur) surfaces, so we render our own list.
// Matches the Genalot UI dropdown: a fixed-width solid dark panel, per-option icons,
// and a Check on the active row.
export type PillOption = { v: string; label: string; disabled?: boolean; icon?: LucideIcon };

export function PillSelect({
  value,
  options,
  onChange,
  title,
  active,
  icon: TriggerIcon,
}: {
  value: string;
  options: PillOption[];
  onChange: (v: string) => void;
  title?: string;
  active?: boolean;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = options.find((o) => o.v === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border py-2 pl-2.5 pr-2 text-[12px] font-medium transition-all ${
          active
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-white/[0.06] bg-white/[0.03] text-white/55 hover:border-white/10 hover:bg-white/[0.06] hover:text-white/80"
        }`}
      >
        {TriggerIcon ? <TriggerIcon className="size-3.5 shrink-0" strokeWidth={1.5} /> : null}
        <span>{cur?.label ?? value}</span>
        <ChevronDown className="size-3 opacity-70" strokeWidth={2} />
      </button>
      {open ? (
        <div className="dropdown-solid animate-fade-in-up absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-xl p-1.5">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={o.disabled}
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                o.v === value ? "bg-primary/10 text-primary" : "text-white/55 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              {o.icon ? <o.icon className="size-3.5 shrink-0" strokeWidth={1.5} /> : null}
              <span className="flex-1">{o.label}</span>
              {o.v === value ? <Check className="ml-auto size-3 shrink-0" strokeWidth={2} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
