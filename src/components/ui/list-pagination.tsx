import Link from "next/link";

import { cn } from "@/lib/utils";

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
        <div className="flex flex-wrap items-center gap-2">
          {prevHref ? (
            <Link href={prevHref} className={linkClass} aria-label="Previous page">
              Previous
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled aria-label="Previous page (unavailable)">
              Previous
            </span>
          )}
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
