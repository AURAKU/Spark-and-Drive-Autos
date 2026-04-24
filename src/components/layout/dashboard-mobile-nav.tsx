"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { partsFinderCtaClassName } from "@/components/parts-finder/parts-finder-cta-link";
import { cn } from "@/lib/utils";

export type DashboardNavLink = { href: string; label: string; ctaStyle?: "parts-finder" };

type Props = {
  links: DashboardNavLink[];
  sectionLabel: string;
  unreadByHref?: Record<string, number>;
};

export function DashboardMobileNav({ links, sectionLabel, unreadByHref }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.08]">
        <Menu className="size-4 shrink-0 opacity-80" aria-hidden />
        Menu
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex h-full max-h-[100dvh] w-[min(100vw-2rem,20rem)] flex-col gap-0 overflow-hidden border-border bg-sidebar p-0 text-sidebar-foreground dark:border-white/10"
      >
        <SheetHeader className="shrink-0 border-b border-sidebar-border px-4 pb-4 pt-4 text-left">
          <SheetTitle className="text-sidebar-foreground">{sectionLabel}</SheetTitle>
          <p className="text-xs font-normal text-muted-foreground">Spark and Drive Autos · dashboard</p>
        </SheetHeader>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-y-contain px-2 py-4 [-webkit-overflow-scrolling:touch]">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
            const unread = unreadByHref?.[l.href] ?? 0;
            if (l.ctaStyle === "parts-finder") {
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    partsFinderCtaClassName,
                    "h-9 min-h-9 w-full justify-center px-3 text-sm",
                    active && "ring-2 ring-orange-200 ring-offset-2 ring-offset-[hsl(240_10%_3.9%)] dark:ring-orange-500/50 dark:ring-offset-0",
                  )}
                >
                  {l.label}
                </Link>
              );
            }
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
                }`}
              >
                <span>{l.label}</span>
                {unread > 0 ? (
                  <span className="shrink-0 rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
