"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { PageHeading } from "@/components/typography/page-headings";

export default function CompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log digest only — never render stack traces or secrets to end users.
    console.error("[compare]", { digest: error?.digest, message: error?.message });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <PageHeading variant="dashboard" className="!text-lg">
          Comparison could not load
        </PageHeading>
        <p className="mt-3 text-sm text-muted-foreground">
          Something went wrong while opening your vehicle comparison. You can try again or return to inventory and pick
          two vehicles.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            Try again
          </button>
          <BrowseCarsCtaLink className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted dark:border-white/15" />
          <Link
            href="/inventory"
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted dark:border-white/15"
          >
            Back to inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
