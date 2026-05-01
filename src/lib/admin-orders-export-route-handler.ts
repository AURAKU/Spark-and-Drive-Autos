import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  buildOrdersExportPdf,
  buildOrdersExportXlsxBuffer,
  buildOrdersExportXlsHtml,
  flattenOrdersToExportLines,
} from "@/lib/admin-orders-export";
import { loadAdminOrdersForExport, type ExportScope } from "@/lib/admin-orders-export-http";

const scopeSchema = z.enum(["filtered", "today", "page", "all", "selected"]);

export async function adminOrdersExportResponse(req: Request, format: "pdf" | "xlsx" | "xls-html"): Promise<Response> {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  let scope: ExportScope = scopeSchema.catch("filtered").parse(url.searchParams.get("scope"));
  let selectedIds: string[] | undefined;

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = z.object({ ids: z.array(z.string().cuid()).min(1).max(500) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide ids: string[] (1–500 CUIDs)" }, { status: 400 });
    }
    selectedIds = parsed.data.ids;
    scope = "selected";
  } else if (scope === "selected") {
    return NextResponse.json({ error: "Selected export requires POST with { ids }" }, { status: 400 });
  }

  const { orders, label } = await loadAdminOrdersForExport({
    scope,
    url,
    rawParams: raw,
    selectedIds,
  });

  const lines = await flattenOrdersToExportLines(orders);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeScope = scope;

  if (format === "pdf") {
    const pdfBytes = await buildOrdersExportPdf(lines, label);
    const filename = `orders-${safeScope}-${stamp}.pdf`;
    return new NextResponse(new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  if (format === "xlsx") {
    const buf = buildOrdersExportXlsxBuffer(lines, label);
    const filename = `orders-${safeScope}-${stamp}.xlsx`;
    return new NextResponse(
      new Blob([Buffer.from(buf)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store",
        },
      },
    );
  }

  const html = buildOrdersExportXlsHtml(lines, label);
  const filename = `orders-${safeScope}-${stamp}.xls`;
  return new NextResponse(html, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
