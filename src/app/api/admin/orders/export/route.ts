import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  buildOrdersExportPdf,
  buildOrdersExportXlsHtml,
  fetchOrdersForAdminExport,
  flattenOrdersToExportLines,
  type OrdersExportKindFilter,
} from "@/lib/admin-orders-export";

import type { OrderKind } from "@prisma/client";

import { parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";

export const dynamic = "force-dynamic";

function filterDescription(kind: OrdersExportKindFilter, dateLabel: string) {
  const k =
    kind === "CAR" ? "Cars Inventory only" : kind === "PARTS" ? "Parts & Accessories only" : "All kinds";
  return dateLabel !== "All dates" ? `${k} · ${dateLabel}` : k;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const kindRaw = url.searchParams.get("kind");
  const kindFilter: OrdersExportKindFilter =
    kindRaw === "CAR" || kindRaw === "PARTS" ? (kindRaw as OrderKind) : null;

  if (format !== "pdf" && format !== "xls") {
    return NextResponse.json({ error: "Invalid format. Use pdf or xls." }, { status: 400 });
  }

  const raw = Object.fromEntries(url.searchParams);
  const ops = parseOpsDateFromSearchParams(raw);
  const rows = await fetchOrdersForAdminExport(kindFilter, ops.range);
  const lines = flattenOrdersToExportLines(rows);
  const label = filterDescription(kindFilter, ops.label);
  const safeKind = kindFilter ?? "all";

  if (format === "pdf") {
    const pdfBytes = await buildOrdersExportPdf(lines, label);
    const filename = `all-orders-${safeKind}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  const html = buildOrdersExportXlsHtml(lines, label);
  const filename = `all-orders-${safeKind}-${new Date().toISOString().slice(0, 10)}.xls`;
  return new NextResponse(html, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
