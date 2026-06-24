"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type PhoneInfo = { display_phone_number?: string; verified_name?: string };
type ConfigResponse = {
  connected?: boolean;
  registered?: boolean;
  phone_info?: PhoneInfo;
};

/**
 * Thin status bar at the top of the inbox showing which WhatsApp number
 * this workspace is connected as. Self-fetches /api/whatsapp/config (a
 * live Meta probe) once on mount. Renders nothing until resolved, and
 * nothing when disconnected — the inbox already shows its own red "not
 * connected" banner in that case, so we don't duplicate it.
 */
export function ConnectedNumberChip() {
  const [data, setData] = useState<ConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whatsapp/config")
      .then((r) => r.json())
      .then((d: ConfigResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ connected: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.connected) return null;

  const name = data.phone_info?.verified_name;
  const number = data.phone_info?.display_phone_number;
  const label = [name, number].filter(Boolean).join(" · ") || "WhatsApp";

  // Token authenticates, but the number isn't subscribed for webhooks —
  // inbound messages won't arrive until registration is finished.
  if (!data.registered) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Connected as <span className="font-semibold">{label}</span>, but not
          receiving messages yet — finish setup in Settings → WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <p className="text-xs text-emerald-600 dark:text-emerald-400">
        Connected as <span className="font-semibold">{label}</span>
      </p>
    </div>
  );
}
