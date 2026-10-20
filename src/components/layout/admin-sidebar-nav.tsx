"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminNavLink } from "@/components/layout/admin-mobile-nav";
import { sidebarLinkActive } from "@/lib/rbac/nav";
import { cn } from "@/lib/utils";

export function AdminSidebarNav({ links }: { links: AdminNavLink[] }) {
  const pathname = usePathname() || "/admin";

  return (
    <nav className="mt-6 space-y-1">
      {links.map((l) => {
        const active = sidebarLinkActive(pathname, l);
        return (
          <Link
            key={l.hubId ?? l.href}
            href={l.href}
            className={cn(
              "inline-flex h-8 w-full items-center justify-start rounded-lg px-2.5 text-sm transition",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
