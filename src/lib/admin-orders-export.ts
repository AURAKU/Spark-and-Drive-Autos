import type { OrderKind } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 1000;

export type OrdersExportKindFilter = OrderKind | null;

export async function fetchOrdersForAdminExport(
  kindFilter: OrdersExportKindFilter,
  dateRange?: { gte: Date; lt: Date } | null,
) {
  return prisma.order.findMany({
    where: {
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(dateRange ? { createdAt: { gte: dateRange.gte, lt: dateRange.lt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: { user: true, car: true, partItems: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export type OrderExportLine = {
  orderReference: string;
  itemTitle: string;
  quantity: string;
  lineAmount: string;
  customer: string;
  orderStatus: string;
  paymentStatus: string;
  orderCreated: string;
};

/** One row per purchased line: car orders = 1 row; parts orders = 1 row per line item. */
export function flattenOrdersToExportLines(
  orders: Awaited<ReturnType<typeof fetchOrdersForAdminExport>>,
): OrderExportLine[] {
  const out: OrderExportLine[] = [];
  for (const o of orders) {
    const pay = o.payments[0]?.status ?? "—";
    const created = o.createdAt.toISOString().slice(0, 10);
    const customer = o.user?.email ?? "—";
    if (o.kind === "CAR") {
      out.push({
        orderReference: o.reference,
        itemTitle: o.car?.title?.trim() || "—",
        quantity: "1",
        lineAmount: formatMoney(Number(o.amount), o.currency),
        customer,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        orderCreated: created,
      });
      continue;
    }
    if (o.partItems.length === 0) {
      out.push({
        orderReference: o.reference,
        itemTitle: "—",
        quantity: "0",
        lineAmount: formatMoney(Number(o.amount), o.currency),
        customer,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        orderCreated: created,
      });
      continue;
    }
    for (const li of o.partItems) {
      out.push({
        orderReference: o.reference,
        itemTitle: li.titleSnapshot.trim() || "—",
        quantity: String(li.quantity),
        lineAmount: formatMoney(Number(li.lineTotal), li.currency),
        customer,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        orderCreated: created,
      });
    }
  }
  return out;
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildOrdersExportXlsHtml(lines: OrderExportLine[], filterLabel: string) {
  const header = [
    "Order ref",
    "Item title",
    "Qty",
    "Line amount",
    "Customer",
    "Order status",
    "Payment",
    "Order date",
  ];
  const trs = lines.map((r) => {
    return `<tr>
<td>${escapeXml(r.orderReference)}</td>
<td>${escapeXml(r.itemTitle)}</td>
<td>${escapeXml(r.quantity)}</td>
<td>${escapeXml(r.lineAmount)}</td>
<td>${escapeXml(r.customer)}</td>
<td>${escapeXml(r.orderStatus)}</td>
<td>${escapeXml(r.paymentStatus)}</td>
<td>${escapeXml(r.orderCreated)}</td>
</tr>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<table border="1">
<tr><th colspan="8">All Orders — ${escapeXml(filterLabel)} (${lines.length} line${lines.length === 1 ? "" : "s"})</th></tr>
<tr>${header.map((h) => `<th>${escapeXml(h)}</th>`).join("")}</tr>
${trs.join("\n")}
</table>
</body></html>`;
}

export async function buildOrdersExportPdf(lines: OrderExportLine[], filterLabel: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 28;
  const lineH = 9;
  const titleSize = 12;
  const bodySize = 6.5;

  let page = doc.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - margin;

  const drawHeader = () => {
    page.drawText("All Orders (line items)", { x: margin, y, size: titleSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH * 1.6;
    page.drawText(filterLabel, { x: margin, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= lineH * 1.3;
    page.drawText(
      `Exported ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · ${lines.length} line${lines.length === 1 ? "" : "s"} (max ${EXPORT_LIMIT} orders)`,
      {
        x: margin,
        y,
        size: 6,
        font,
        color: rgb(0.45, 0.45, 0.45),
      },
    );
    y -= lineH * 2;
  };

  drawHeader();

  const cols = [
    { w: 54, label: "Order ref" },
    { w: 128, label: "Item title" },
    { w: 22, label: "Qty" },
    { w: 56, label: "Line amt" },
    { w: 72, label: "Customer" },
    { w: 52, label: "Ord stat" },
    { w: 40, label: "Pay" },
    { w: 48, label: "Date" },
  ] as const;

  const truncate = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

  const tableHeader = () => {
    let x = margin;
    for (const c of cols) {
      page.drawText(c.label, { x, y, size: bodySize, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
      x += c.w;
    }
    y -= lineH * 1.15;
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: width - margin, y: y + 2 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= lineH * 0.35;
  };

  tableHeader();

  for (const r of lines) {
    if (y < margin + lineH * 10) {
      page = doc.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - margin;
      drawHeader();
      tableHeader();
    }

    const cells = [
      truncate(r.orderReference, 11),
      truncate(r.itemTitle, 42),
      truncate(r.quantity, 4),
      truncate(r.lineAmount, 12),
      truncate(r.customer, 18),
      truncate(r.orderStatus.replaceAll("_", " "), 12),
      truncate(r.paymentStatus, 8),
      r.orderCreated,
    ];

    let x = margin;
    for (let i = 0; i < cols.length; i++) {
      page.drawText(cells[i], { x, y, size: bodySize, font, color: rgb(0.2, 0.2, 0.2) });
      x += cols[i].w;
    }
    y -= lineH * 1.05;
  }

  return doc.save();
}
