"use client";

import Link from "next/link";
import { useMemo } from "react";

type Props = {
  /** Path or full URL to the PDF (same-origin for iframe) */
  pdfSrc: string;
  backLabel: string;
  backHref: string;
  downloadHref: string;
  /** Shown in iframe title / accessibility */
  documentTitle: string;
};

export function ReceiptPdfPreview({ pdfSrc, backLabel, backHref, downloadHref, documentTitle }: Props) {
  const iframeSrc = useMemo(() => {
    if (!pdfSrc) return "";
    if (pdfSrc.startsWith("/")) return pdfSrc;
    if (/^https?:\/\//i.test(pdfSrc)) return pdfSrc;
    return pdfSrc.startsWith("receipts/") ? `/${pdfSrc}` : pdfSrc;
  }, [pdfSrc]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          {backLabel}
        </Link>
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-[var(--brand)] hover:underline dark:border-white/15"
        >
          Open in new tab
        </a>
        <a
          href={downloadHref}
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-black hover:opacity-95"
        >
          Download PDF
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 dark:border-white/10 dark:bg-black/40">
        {iframeSrc ? (
          <iframe
            title={documentTitle}
            src={`${iframeSrc}#toolbar=1`}
            className="min-h-[72vh] w-full bg-white"
          />
        ) : (
          <p className="p-8 text-sm text-muted-foreground">Receipt file is not available.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground dark:text-zinc-500">
        If the preview does not load (browser PDF blocker), use Open in new tab or Download PDF.
      </p>
    </div>
  );
}
