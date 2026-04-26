"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { appendOpsDateParams } from "@/lib/admin-operations-date-filter";

function buildOrdersExportHref(searchParams: URLSearchParams, format: "pdf" | "xls"): string {
  const p = new URLSearchParams();
  p.set("format", format);
  const raw = Object.fromEntries(searchParams.entries());
  appendOpsDateParams(p, raw);
  const kind = searchParams.get("kind");
  if (kind === "CAR" || kind === "PARTS") p.set("kind", kind);
  const pl = searchParams.get("partsLineage");
  if (pl === "ghana" || pl === "china_preorder") p.set("partsLineage", pl);
  const q = searchParams.get("q");
  if (q && q.trim()) p.set("q", q.trim());
  return `/api/admin/orders/export?${p.toString()}`;
}

export function AdminOrdersExportButtons() {
  const searchParams = useSearchParams();
  const pdfHref = useMemo(() => buildOrdersExportHref(searchParams, "pdf"), [searchParams]);
  const xlsHref = useMemo(() => buildOrdersExportHref(searchParams, "xls"), [searchParams]);

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
