"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { TopNav } from "@/components/layout/top-nav";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="genalot-canvas flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Genalot UI shell: a near-black canvas with the ambient background, an in-flow top
  // navbar, then the main region. Main keeps the old bounded, internally-scrolling
  // model (viewport height) + the same p-4/p-6 padding, so existing pages that rely
  // on it (Ad Studio's edge-bleed) still lay out correctly. The navbar frosts on this
  // container's scroll (id="app-scroll").
  return (
    <div className="genalot-canvas relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AmbientBackground />
      <TopNav />
      <main id="app-scroll" className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
