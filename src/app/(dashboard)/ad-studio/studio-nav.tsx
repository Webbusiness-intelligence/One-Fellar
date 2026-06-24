import Link from "next/link";
import { Sparkles, Images, Fingerprint, Film } from "lucide-react";

// Poster / Commercial / Quick ads are intentionally KEPT in the codebase — their
// routes (/ad-studio/poster, /commercial, /quick) still work and we'll use them
// again — but they're removed from the nav so the studio centres on Create
// (image generation) + Gallery. Soul ID (asset / character / location library
// with @image references) joins this nav once its page is built.
const TABS = [
  { id: "chat", label: "Create", href: "/ad-studio", icon: Sparkles },
  { id: "soul", label: "Soul ID", href: "/ad-studio/soul", icon: Fingerprint },
  { id: "video", label: "Video", href: "/ad-studio/video", icon: Film },
  { id: "gallery", label: "Gallery", href: "/ad-studio/gallery", icon: Images },
] as const;

export function StudioNav({
  active,
}: {
  active: "chat" | "poster" | "commercial" | "quick" | "gallery" | "soul" | "video";
}) {
  return (
    <div className="mx-auto mb-4 flex max-w-6xl items-center gap-1">
      {TABS.map((t) => {
        const Icon = t.icon;
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              on
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4" strokeWidth={2} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
