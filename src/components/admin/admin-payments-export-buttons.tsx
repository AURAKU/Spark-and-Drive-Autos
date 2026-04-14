"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { appendOpsDateParams } from "@/lib/admin-operations-date-filter";

function buildIntelExportHref(searchParams: URLSearchParams, format: "pdf" | "xls"): string {
  const p = new URLSearchParams();
  p.set("format", format);
  const raw = Object.fromEntries(searchParams.entries());
  appendOpsDateParams(p, raw);
  const method = searchParams.get("method");
  const status = searchParams.get("status");
  const period = searchParams.get("period");
  const q = searchParams.get("q");
  if (method) p.set("method", method);
  if (status) p.set("status", status);
  if (period) p.set("period", period);
  if (q) p.set("q", q);
  const dc = searchParams.get("displayCurrency");
  if (dc === "USD" || dc === "CNY") p.set("displayCurrency", dc);
  const orderKind = searchParams.get("orderKind");
  if (orderKind === "CAR" || orderKind === "PARTS") p.set("orderKind", orderKind);
  return `/api/admin/payments/intelligence/export?${p.toString()}`;
}

export function AdminPaymentsExportButtons() {
  const searchParams = useSearchParams();
  const pdfHref = useMemo(() => buildIntelExportHref(searchParams, "pdf"), [searchParams]);
  const xlsHref = useMemo(() => buildIntelExportHref(searchParams, "xls"), [searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Export</span>
      <a
        href={pdfHref}
        className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/50 hover:text-white"
      >
        PDF
      </a>
      <a
        href={xlsHref}
        className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/50 hover:text-white"
      >
        Excel (.xls)
      </a>
    </div>
  );
}
