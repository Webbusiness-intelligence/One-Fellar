"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { CreditCard, LogOut, Send, Settings, Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";

const navLinks = [
  { label: "Ad Studio", icon: Sparkles, href: "/ad-studio" },
  { label: "Social", icon: Send, href: "/social" },
  { label: "Pricing", icon: CreditCard, href: "/pricing" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

// Fixed top navbar for the app shell (Genalot UI redesign). Transparent over the
// ambient background, frosting into glass once the page scrolls. Replaces the old
// left sidebar + header — every nav destination and the account menu move up here.
export function TopNav() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // The app scrolls inside the shell's #app-scroll <main>, not the window.
    const el = document.getElementById("app-scroll");
    const target: HTMLElement | Window = el ?? window;
    const readTop = () => (el ? el.scrollTop : window.scrollY);
    const onScroll = () => setScrolled(readTop() > 20);
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <nav
      className={cn(
        "relative z-50 shrink-0 transition-all duration-500",
        scrolled ? "glass-strong border-b border-white/[0.06]" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-1">
          <Link href="/ad-studio" className="group mr-2 flex items-center gap-2.5 sm:mr-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/genalot-icon.png"
              alt="Genalot"
              className="h-8 w-8 rounded-lg transition-transform duration-300 group-hover:scale-105"
            />
            <span className="hidden text-[15px] font-semibold tracking-tight text-white/90 sm:inline">
              Genalot
            </span>
          </Link>

          <div className="flex items-center">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-300 sm:px-3.5",
                    isActive ? "text-white" : "text-white/40 hover:text-white/70",
                  )}
                >
                  <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                  <span className="hidden md:inline">{link.label}</span>
                  {isActive && (
                    <span className="absolute inset-0 -z-10 rounded-lg border border-white/[0.08] bg-white/[0.06]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: mode toggle + account */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none data-popup-open:bg-white/[0.06]"
              aria-label="Open account menu"
            >
              <Avatar className="size-8">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="dropdown-solid min-w-56 text-popover-foreground ring-border"
            >
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
