"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardNavLink } from "@/components/layout/dashboard-mobile-nav";
import { partsFinderCtaClassName } from "@/components/parts-finder/parts-finder-cta-link";
import { cn } from "@/lib/utils";

type Props = {
  links: DashboardNavLink[];
  unreadByHref?: Record<string, number>;
};

export function DashboardSidebarNav({ links, unreadByHref }: Props) {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-1 pb-2" aria-label="Dashboard sections">
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
        const unread = unreadByHref?.[l.href] ?? 0;
        if (l.ctaStyle === "parts-finder") {
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                partsFinderCtaClassName,
                "h-9 min-h-9 w-full justify-center px-3 text-sm",
                active && "ring-2 ring-orange-200 ring-offset-2 ring-offset-sidebar dark:ring-orange-500/50",
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
            className={`inline-flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-sm transition ${
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <span>{l.label}</span>
            {l.href === "/dashboard/notifications" && unread > 0 ? (
              <span className="rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
