"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type FilterKey = "all" | "cars" | "parts";

function currentFilter(sp: URLSearchParams): FilterKey {
  const t = sp.get("type")?.toLowerCase() ?? "";
  if (t === "cars" || t === "car") return "cars";
  if (t === "parts" || t === "part" || t === "accessories") return "parts";
  return "all";
}

function buildHref(
  basePath: string,
  sp: URLSearchParams,
  patch: { type?: FilterKey; page?: number; clearPage?: boolean },
) {
  const p = new URLSearchParams(sp.toString());
  if (patch.type != null) {
    if (patch.type === "all") p.delete("type");
    else p.set("type", patch.type);
  }
  if (patch.clearPage) p.delete("page");
  if (patch.page != null) {
    if (patch.page <= 1) p.delete("page");
    else p.set("page", String(patch.page));
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ShippingTypeFilters() {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard/shipping";
  const searchParams = useSearchParams();
  const active = currentFilter(searchParams);

  const items: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "cars", label: "Cars" },
    { key: "parts", label: "Parts & accessories" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show</span>
      <div
        className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 dark:border-white/10 dark:bg-white/[0.04]"
        role="group"
        aria-label="Filter by order type"
      >
        {items.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                const p = new URLSearchParams(searchParams.toString());
                if (key === "all") p.delete("type");
                else p.set("type", key);
                p.delete("page");
                const qs = p.toString();
                router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
              }}
              className={cn(
                "min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                isActive
                  ? "bg-[var(--brand)]/20 text-[var(--brand)] shadow-sm dark:bg-[var(--brand)]/15"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:hover:bg-white/10",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShippingPagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard/shipping";
  const searchParams = useSearchParams();
  const sp = new URLSearchParams(searchParams.toString());

  if (total === 0) {
    return null;
  }

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <p className="text-xs text-muted-foreground">
        Showing {start}–{end} of {total} shipment{total === 1 ? "" : "s"}
      </p>
      {totalPages <= 1 ? null : (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => {
                if (!canPrev) return;
                const href = buildHref(pathname, sp, { page: page - 1 });
                router.push(href, { scroll: false });
              }}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted/80 dark:border-white/10 dark:hover:bg-white/[0.08]"
            >
              Previous
            </button>
            <label className="ml-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="sr-only">Page</span>
              <span className="text-xs sm:not-sr-only sm:inline">Page</span>
              <select
                value={page}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const href = buildHref(pathname, sp, { page: n });
                  router.push(href, { scroll: false });
                }}
                className="h-9 min-w-[4.5rem] rounded-lg border border-border bg-card px-2 text-sm text-foreground dark:border-white/10"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} / {totalPages}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                if (!canNext) return;
                const href = buildHref(pathname, sp, { page: page + 1 });
                router.push(href, { scroll: false });
              }}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted/80 dark:border-white/10 dark:hover:bg-white/[0.08]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
