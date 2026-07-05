"use client";

import Link from "next/link";
import { GitCompare } from "lucide-react";

import { useCarCompare } from "@/components/cars/car-compare-context";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { PageHeading } from "@/components/typography/page-headings";

export function CarCompareEmptyState() {
  const { entries, compareHref } = useCarCompare();

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/40 dark:border-white/10">
        <GitCompare className="size-7 text-[var(--brand)]" aria-hidden />
      </div>
      <PageHeading variant="hero">Compare vehicles</PageHeading>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Select two cars from inventory using the <span className="font-medium text-foreground">Compare</span> button on each
        listing, then return here to review specifications side by side.
      </p>
      {entries.length > 0 ? (
        <p className="text-sm text-foreground">
          You have {entries.length} vehicle{entries.length === 1 ? "" : "s"} selected
          {compareHref ? (
            <>
              {" "}
              —{" "}
              <Link href={compareHref} className="font-semibold text-[var(--brand)] hover:underline">
                open comparison
              </Link>
            </>
          ) : (
            ". Pick one more from inventory."
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <BrowseCarsCtaLink className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-black hover:opacity-90" />
        <Link
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium text-foreground hover:bg-muted dark:border-white/15"
        >
          Browse inventory
        </Link>
      </div>
    </div>
  );
}
