"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type AdminNavLink = { href: string; label: string };

type Props = {
  links: AdminNavLink[];
  sectionLabel: string;
};

export function AdminMobileNav({ links, sectionLabel }: Props) {
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
          <p className="text-xs font-normal text-muted-foreground">Spark and Drive Autos · admin</p>
        </SheetHeader>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-y-contain px-2 py-4 [-webkit-overflow-scrolling:touch]">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href));
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
                <span className="min-w-0 break-words">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
