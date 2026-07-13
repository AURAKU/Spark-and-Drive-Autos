"use client";

import Link from "next/link";
import { ArrowLeftRight, ExternalLink } from "lucide-react";
import { useMemo } from "react";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import type { CarCompareRow } from "@/lib/car-compare";
import { cn } from "@/lib/utils";

type CarSummary = {
  slug: string;
  title: string;
  brand: string;
  year: number;
  coverImageUrl: string | null;
  priceLabel: string;
};

type Props = {
  left: CarSummary;
  right: CarSummary;
  rows: CarCompareRow[];
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  /** Precomputed on the server — functions cannot cross the RSC → client boundary. */
  prevHref: string | null;
  nextHref: string | null;
  pageHrefs?: string[];
  swapHref: string;
};

function CarCompareHeroCard({ car, side }: { car: CarSummary; side: "left" | "right" }) {
  return (
    <article
      className={cn(
        "relative flex min-h-full flex-col overflow-hidden bg-card dark:bg-[#181C22]",
        side === "left" ? "lg:border-r lg:border-border lg:dark:border-white/10" : "",
      )}
    >
      <div className="relative aspect-[16/10] bg-muted dark:bg-zinc-900">
        {car.coverImageUrl ? (
          <VehicleCoverImage
            src={car.coverImageUrl}
            alt=""
            fill
            sizes="(max-width:1024px) 100vw, 50vw"
            deliveryPreset="galleryStrip"
            className="object-cover"
            imagePlaceholder
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Image unavailable</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          {side === "left" ? "Vehicle A" : "Vehicle B"} · {car.brand} · {car.year}
        </p>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{car.title}</h2>
        <p className="text-2xl font-semibold text-[var(--brand)]">{car.priceLabel}</p>
        <Link
          href={`/cars/${car.slug}`}
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          View full listing
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function CarCompareView({
  left,
  right,
  rows,
  page,
  totalPages,
  totalRows,
  pageSize,
  prevHref,
  nextHref,
  pageHrefs,
  swapHref,
}: Props) {
  const diffCount = useMemo(() => rows.filter((row) => row.differs).length, [rows]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-sm dark:border-white/10">
        <div className="grid lg:grid-cols-2">
          <CarCompareHeroCard car={left} side="left" />
          <CarCompareHeroCard car={right} side="right" />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-[18%] z-10 hidden -translate-x-1/2 lg:flex"
          aria-hidden
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-background text-xs font-bold tracking-[0.2em] text-foreground shadow-lg dark:border-white/15 dark:bg-[#12151a]">
            VS
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Specification comparison</p>
          {diffCount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-[var(--brand)]">{diffCount}</span> difference
              {diffCount === 1 ? "" : "s"} on this page
            </p>
          ) : null}
        </div>
        <Link
          href={swapHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted dark:border-white/15"
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Swap sides
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border dark:border-white/10">
        <div className="hidden grid-cols-2 bg-muted/50 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:grid dark:bg-white/[0.04]">
          <div className="border-b border-r border-border px-4 py-3 dark:border-white/10">{left.title}</div>
          <div className="border-b border-border px-4 py-3 dark:border-white/10">{right.title}</div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-2">
          {[left, right].map((car, columnIndex) => (
            <ul
              key={car.slug}
              className={cn(columnIndex === 0 && "border-r border-border dark:border-white/10")}
            >
              {rows.map((row) => (
                <li
                  key={`${car.slug}-${row.key}`}
                  className={cn(
                    "border-b border-border px-4 py-3 last:border-b-0 dark:border-white/5",
                    row.differs && "bg-[var(--brand)]/[0.04] dark:bg-[var(--brand)]/[0.06]",
                  )}
                >
                  <p className="text-xs font-semibold text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-sm text-foreground">{columnIndex === 0 ? row.left : row.right}</p>
                </li>
              ))}
            </ul>
          ))}
        </div>

        <div className="lg:hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] bg-muted/50 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid dark:bg-white/[0.04]">
            <div className="border-b border-border px-4 py-3 dark:border-white/10">Attribute</div>
            <div className="border-b border-l border-border px-4 py-3 dark:border-white/10">{left.brand}</div>
            <div className="border-b border-l border-border px-4 py-3 dark:border-white/10">{right.brand}</div>
          </div>
          <ul>
            {rows.map((row) => (
              <li
                key={row.key}
                className={cn(
                  "grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-0 dark:border-white/5",
                  row.differs && "bg-[var(--brand)]/[0.04] dark:bg-[var(--brand)]/[0.06]",
                )}
              >
                <div className="text-xs font-semibold text-muted-foreground sm:py-1">{row.label}</div>
                <div className="text-sm text-foreground sm:border-l sm:border-border sm:px-4 sm:py-1 dark:sm:border-white/10">
                  <span className="mr-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:hidden">
                    {left.brand}
                  </span>
                  {row.left}
                </div>
                <div className="text-sm text-foreground sm:border-l sm:border-border sm:px-4 sm:py-1 dark:sm:border-white/10">
                  <span className="mr-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:hidden">
                    {right.brand}
                  </span>
                  {row.right}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No specification rows on this page.</p>
      ) : null}

      {totalRows > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={totalRows}
          pageSize={pageSize}
          itemLabel="Specifications"
          prevHref={prevHref}
          nextHref={nextHref}
          pageHrefs={totalPages > 1 ? pageHrefs : undefined}
          showPerPageNote
        />
      ) : null}
    </div>
  );
}
