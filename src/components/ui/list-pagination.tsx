import Link from "next/link";

import { ListPaginationPageSelect } from "@/components/ui/list-pagination-page-select";
import { cn } from "@/lib/utils";

/** Compact page list with ellipses for long ranges (1 … 4 5 6 … 20). */
function buildPaginationPageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const s = new Set<number>([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  const sorted = [...s].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

function ListPaginationPageLinks({
  page,
  totalPages,
  pageHrefs,
}: {
  page: number;
  totalPages: number;
  pageHrefs: string[];
}) {
  if (totalPages <= 1 || pageHrefs.length !== totalPages) return null;
  const window = buildPaginationPageWindow(page, totalPages);
  return (
    <nav className="flex max-w-full flex-wrap items-center justify-center gap-1 sm:justify-start" aria-label="Page numbers">
      {window.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="inline-flex min-h-9 min-w-6 items-center justify-center px-0.5 text-muted-foreground select-none" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={pageHrefs[item - 1]!}
            className={cn(
              "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-xs font-medium tabular-nums shadow-sm transition",
              item === page
                ? "border-[var(--brand)]/45 bg-[var(--brand)]/12 text-foreground ring-1 ring-[var(--brand)]/25 dark:bg-[var(--brand)]/18"
                : "border-border bg-card text-foreground hover:border-[var(--brand)]/35 hover:bg-muted dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.07]",
            )}
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </Link>
        )
      )}
    </nav>
  );
}

type Props = {
  prevHref: string | null;
  nextHref: string | null;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** Shown in the summary line, e.g. "payments" or "wallet transactions". */
  itemLabel: string;
  className?: string;
  /** When false, only Previous/Next controls render (e.g. duplicate nav above a list). Default true. */
  showSummary?: boolean;
  /** When true, appends “· {pageSize} per page” to the summary. Default false. */
  showPerPageNote?: boolean;
  /**
   * When set (length must equal `totalPages`), a page dropdown is shown so users can jump to any page.
   * `pageHrefs[i]` = URL for page `i + 1`.
   */
  pageHrefs?: string[];
};

export function ListPaginationFooter({
  prevHref,
  nextHref,
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  className,
  showSummary = true,
  showPerPageNote = false,
  pageHrefs,
}: Props) {
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const linkClass =
    "inline-flex min-h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition hover:border-[var(--brand)]/35 hover:bg-muted hover:text-foreground dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-white/25 dark:hover:bg-white/[0.07] dark:hover:text-white";
  const disabledClass =
    "pointer-events-none inline-flex min-h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-border/60 bg-muted/40 px-3 text-xs font-medium text-muted-foreground dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-600";

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5",
        className,
      )}
    >
      {showSummary ? (
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground/80">{itemLabel}</span>
          {totalItems > 0 ? (
            <>
              {" "}
              · Showing <span className="font-mono text-foreground/90">{from}</span>–<span className="font-mono text-foreground/90">{to}</span> of{" "}
              <span className="font-mono text-foreground/90">{totalItems}</span>
              {totalPages > 1 ? (
                <>
                  {" "}
                  · Page <span className="font-mono text-foreground/90">{page}</span> of{" "}
                  <span className="font-mono text-foreground/90">{totalPages}</span>
                </>
              ) : null}
              {showPerPageNote ? (
                <>
                  {" "}
                  · <span className="font-mono text-foreground/90">{pageSize}</span> per page
                </>
              ) : null}
            </>
          ) : (
            <> · No rows</>
          )}
        </p>
      ) : null}
      {totalItems > 0 ? (
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
          {prevHref ? (
            <Link href={prevHref} className={linkClass} aria-label="Previous page">
              Previous
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled aria-label="Previous page (unavailable)">
              Previous
            </span>
          )}
          {pageHrefs && pageHrefs.length === totalPages && totalPages > 1 ? (
            <ListPaginationPageLinks page={page} totalPages={totalPages} pageHrefs={pageHrefs} />
          ) : null}
          {pageHrefs && pageHrefs.length > 0 ? (
            <ListPaginationPageSelect pageHrefs={pageHrefs} currentPage={page} totalPages={totalPages} />
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className={linkClass} aria-label="Next page">
              Next
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled aria-label="Next page (unavailable)">
              Next
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
