import { NextResponse } from "next/server";

import { buildPaymentIntelligenceFilters } from "@/lib/admin-payment-intelligence-filters";
import {
  buildPaymentsIntelExportPdf,
  buildPaymentsIntelExportXlsHtml,
  fetchPaymentsForIntelExport,
} from "@/lib/admin-payments-export";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

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
  if (format !== "pdf" && format !== "xls") {
    return NextResponse.json({ error: "Invalid format. Use pdf or xls." }, { status: 400 });
  }

  const raw = Object.fromEntries(url.searchParams);
  const { basePaymentWhere, ops } = buildPaymentIntelligenceFilters(raw);
  const rows = await fetchPaymentsForIntelExport(basePaymentWhere);
  const label = ops.label !== "All dates" ? ops.label : "All dates";

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const pdfBytes = await buildPaymentsIntelExportPdf(rows, label);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="payments-intelligence-${stamp}.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  const html = buildPaymentsIntelExportXlsHtml(rows, label);
  return new NextResponse(html, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="payments-intelligence-${stamp}.xls"`,
      "cache-control": "no-store",
    },
  });
}
