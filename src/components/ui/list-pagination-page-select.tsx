"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = {
  /** `hrefs[0]` = page 1, length must match total pages. */
  pageHrefs: string[];
  currentPage: number;
  totalPages: number;
  /** Shown before the select; keep short for mobile. */
  label?: string;
  className?: string;
};

/**
 * Native select to jump to a specific page. Parent passes full hrefs (built on the server) so URL rules stay in one place.
 */
export function ListPaginationPageSelect({ pageHrefs, currentPage, totalPages, label = "Page", className }: Props) {
  const router = useRouter();
  if (totalPages <= 1 || pageHrefs.length !== totalPages) return null;

  return (
    <label
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground shadow-sm dark:border-white/15 dark:bg-white/[0.04]",
        className,
      )}
    >
      <span className="shrink-0 pl-0.5 text-muted-foreground">{label}</span>
      <select
        className="h-8 max-w-[min(100%,9rem)] cursor-pointer bg-transparent py-0 pr-1 text-sm font-mono text-foreground outline-none"
        aria-label="Go to page"
        value={String(currentPage)}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          const href = pageHrefs[n - 1];
          if (href) router.push(href);
        }}
      >
        {pageHrefs.map((_, i) => {
          const p = i + 1;
          return (
            <option key={p} value={String(p)}>
              {p} / {totalPages}
            </option>
          );
        })}
      </select>
    </label>
  );
}
