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
      <SheetTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-zinc-200 transition hover:bg-white/[0.08] hover:text-white">
        <Menu className="size-4 shrink-0 opacity-80" aria-hidden />
        Menu
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(100vw-2rem,20rem)] border-white/10 bg-[#05070b] text-white"
      >
        <SheetHeader className="border-b border-white/10 pb-4 text-left">
          <SheetTitle className="text-white">{sectionLabel}</SheetTitle>
          <p className="text-xs font-normal text-zinc-500">Spark and Drive Autos · admin</p>
        </SheetHeader>
        <nav className="mt-4 flex flex-col gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
