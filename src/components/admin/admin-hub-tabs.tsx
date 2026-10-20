"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type AdminHubTab = {
  id: string;
  label: string;
  href: string;
};

function tabActive(pathname: string, search: string, href: string): boolean {
  try {
    const url = new URL(href, "http://local.invalid");
    const pathMatch =
      pathname === url.pathname || (url.pathname !== "/admin" && pathname.startsWith(`${url.pathname}/`));
    if (!pathMatch && pathname !== url.pathname) return false;
    if (!url.search) {
      return pathname === url.pathname && !search;
    }
    const want = new URLSearchParams(url.search);
    const have = new URLSearchParams(search);
    for (const [k, v] of want.entries()) {
      if (have.get(k) !== v) return false;
    }
    return pathname === url.pathname;
  } catch {
    return pathname === href;
  }
}

export function AdminHubTabs({
  tabs,
  label = "Section",
}: {
  tabs: AdminHubTab[];
  label?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  if (tabs.length <= 1) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-border bg-muted/40 p-1.5 dark:border-white/10 dark:bg-white/[0.03]"
      role="tablist"
      aria-label={label}
    >
      <div className="sda-chip-scroll">
        {tabs.map((tab) => {
          const active = tabActive(pathname, search, tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={active}
              scroll={false}
              className={cn(
                "inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-[var(--brand)] text-black"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
