import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Shared frame for the public legal pages (Terms, Privacy, Refund). Dark, clean,
// generous reading column, cross-links between the three documents.
const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
];

export function LegalShell({
  title,
  updated,
  intro,
  active,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="genalot-canvas relative min-h-screen bg-[#050508] text-white">
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/genalot-icon.png" alt="Genalot" className="h-8 w-8 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight text-white/90">Genalot</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-[1100px] gap-12 px-6 py-12 lg:flex">
        {/* Sidebar cross-links */}
        <aside className="mb-8 shrink-0 lg:mb-0 lg:w-56">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Legal</p>
            <nav className="flex flex-col gap-1">
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-2 text-[13px] transition-colors ${
                    active === l.href ? "bg-primary/10 font-medium text-primary" : "text-white/50 hover:bg-white/[0.03] hover:text-white/80"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Document */}
        <article className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-[13px] text-white/35">Last updated: {updated} · Effective: {updated}</p>
          <p className="mt-6 text-[14px] leading-relaxed text-white/60">{intro}</p>
          <div className="mt-2">{children}</div>

          <div className="mt-14 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <p className="text-[13px] leading-relaxed text-white/40">
              Questions about this document? Contact us at{" "}
              <a href="mailto:support@genalot.com" className="text-primary/70 hover:text-primary">support@genalot.com</a>. This
              page is provided for transparency and does not constitute legal advice.
            </p>
          </div>
        </article>
      </div>

      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-4 text-[12px] text-white/25 sm:flex-row">
          <span>© 2026 Genalot. All rights reserved.</span>
          <div className="flex items-center gap-5">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-white/50">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---- Content primitives (consistent legal typography) ------------------------
export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10 scroll-mt-24" id={`s-${n}`}>
      <h2 className="mb-3 text-lg font-semibold text-white">
        <span className="mr-2 text-primary/60">{n}.</span>
        {title}
      </h2>
      <div className="space-y-4 text-[14px] leading-relaxed text-white/60">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 mt-5 text-[15px] font-semibold text-white/85">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/50" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
