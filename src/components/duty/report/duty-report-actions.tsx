"use client";

import Link from "next/link";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";

type Props = {
  calculationId: string;
  accessToken?: string | null;
  backHref?: string;
};

export function DutyReportActions({ calculationId, accessToken, backHref = "/inventory" }: Props) {
  const [printing, setPrinting] = useState(false);
  const exportQs = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
  const pdfHref = `/duty-report/${calculationId}/export${exportQs}`;

  function handlePrint() {
    setPrinting(true);
    try {
      window.print();
    } finally {
      window.setTimeout(() => setPrinting(false), 500);
    }
  }

  return (
    <div className="duty-report-actions no-print mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-1 py-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
        >
          {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" aria-hidden />}
          Print Report
        </button>
        <a
          href={pdfHref}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-900"
        >
          <Download className="size-4" aria-hidden />
          Download PDF
        </a>
      </div>
    </div>
  );
}
