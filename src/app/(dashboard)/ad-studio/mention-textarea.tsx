"use client";

import { useEffect, useRef } from "react";

// A textarea that visually highlights @handle mentions (linked Soul IDs) in the
// accent colour. A backdrop <div> mirrors the text with coloured mention spans;
// the real <textarea> sits on top with transparent text + a visible caret, so
// typing/selection stay native while the mention shows as a linked element.
export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 1,
  maxLines = 8,
  handles,
  boxClassName = "",
  fieldClassName = "",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  maxLines?: number;
  handles: Set<string>;
  boxClassName?: string;
  fieldClassName?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow with content up to `maxLines`, then scroll.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 20;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const min = lh * rows + padY;
    const max = lh * maxLines + padY;
    const next = Math.min(Math.max(ta.scrollHeight, min), max);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, [value, rows, maxLines]);

  const syncScroll = () => {
    const ta = taRef.current;
    const bd = backdropRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  };

  // Split the value into plain text + coloured mention spans.
  const nodes: React.ReactNode[] = [];
  const re = /@([a-zA-Z0-9_-]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (m.index > last) nodes.push(value.slice(last, m.index));
    const linked = handles.has(m[1].toLowerCase());
    nodes.push(
      linked ? (
        <span key={key++} className="rounded bg-primary/15 font-medium text-primary">
          {m[0]}
        </span>
      ) : (
        m[0]
      ),
    );
    last = m.index + m[0].length;
  }
  nodes.push(value.slice(last));
  nodes.push("\n"); // keep backdrop height in sync on a trailing newline

  return (
    <div className={`relative ${boxClassName}`}>
      <div
        ref={backdropRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-foreground ${fieldClassName}`}
      >
        {nodes}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        rows={rows}
        placeholder={placeholder}
        className={`relative w-full resize-none bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/30 placeholder:text-muted-foreground ${fieldClassName}`}
      />
    </div>
  );
}
