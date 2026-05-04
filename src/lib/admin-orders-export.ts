import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFImage } from "pdf-lib";
import * as XLSX from "xlsx";

import { formatMoney } from "@/lib/format";
import { getGlobalCurrencySettings } from "@/lib/currency";
import type { DeliveryMode, Prisma } from "@prisma/client";

import {
  type AdminCarOrderLaneFilter,
  type AdminOrderRich,
  ADMIN_ORDERS_EXPORT_MAX,
  buildAdminOrdersBaseWhere,
  computeOrderFinancialPreview,
  fetchAdminOrdersRich,
  firstCarImageUrl,
  firstPartLineImageUrl,
  shippingFeeStatus,
  shippingSummary,
  type OrdersExportKindFilter,
} from "@/lib/admin-orders-export-query";

export type { OrdersExportKindFilter, AdminCarOrderLaneFilter };
export {
  ADMIN_ORDERS_PAGE_SIZE,
  ADMIN_ORDERS_EXPORT_MAX,
  adminOrderRichSelect,
  buildAdminOrdersBaseWhere,
  fetchAdminOrdersRich,
  firstCarImageUrl,
  firstPartLineImageUrl,
  type AdminOrderRich,
  computeOrderFinancialPreview,
  localTodayRange,
  shippingSummary,
  shippingFeeStatus,
  totalSuccessfulPaymentsGhs,
} from "@/lib/admin-orders-export-query";

export type OrderExportLine = {
  orderReference: string;
  itemTitle: string;
  itemType: "CAR" | "PARTS";
  quantity: string;
  lineAmount: string;
  productPriceGhs: string;
  depositPaidGhs: string;
  outstandingGhs: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderStatus: string;
  paymentStatus: string;
  paymentType: string;
  deliveryMode: string;
  shippingFeeStatus: string;
  orderCreated: string;
  dueOrEta: string;
  adminNotes: string;
  itemImageUrl: string;
};

export async function fetchOrdersForAdminExport(
  kindFilter: OrdersExportKindFilter,
  dateRange?: { gte: Date; lt: Date } | null,
  partsLineage: import("@/lib/admin-orders-parts-filter").AdminPartsLineage = null,
  searchWhere: Prisma.OrderWhereInput | null = null,
  opts?: {
    skip?: number;
    take?: number;
    orderIds?: string[];
    partsDeliveryMode?: DeliveryMode | null;
    carOrderLane?: AdminCarOrderLaneFilter;
  },
) {
  const where = buildAdminOrdersBaseWhere(
    kindFilter,
    dateRange,
    partsLineage,
    searchWhere,
    opts?.partsDeliveryMode,
    opts?.carOrderLane,
  );
  return fetchAdminOrdersRich(where, {
    ...opts,
    take: opts?.take ?? ADMIN_ORDERS_EXPORT_MAX,
  });
}

export async function flattenOrdersToExportLines(
  orders: AdminOrderRich[],
): Promise<OrderExportLine[]> {
  const settings = await getGlobalCurrencySettings();

  const out: OrderExportLine[] = [];
  for (const o of orders) {
    const fin = computeOrderFinancialPreview(o, settings);
    const pay = o.payments[0]?.status ?? "—";
    const created = o.createdAt.toISOString().slice(0, 10);
    const customerName = o.user?.name?.trim() || "—";
    const customerEmail = o.user?.email ?? "—";
    const customerPhone = o.user?.phone?.trim() || "—";
    const delivery = shippingSummary(o);
    const shipFee = shippingFeeStatus(o);
    const dueOrEta = o.shipments[0]?.estimatedDuration?.trim() || "—";
    const adminNotes = o.notes?.trim() ? o.notes.trim().slice(0, 500) : "—";
    const depositStr =
      fin.depositPaidGhs != null ? formatMoney(fin.depositPaidGhs, o.currency) : "—";
    const outStr =
      fin.outstandingGhs != null ? formatMoney(fin.outstandingGhs, o.currency) : "—";
    const listStr = fin.fullListGhs != null ? formatMoney(fin.fullListGhs, o.currency) : "—";

    if (o.kind === "CAR") {
      out.push({
        orderReference: o.reference,
        itemTitle: o.car?.title?.trim() || "—",
        itemType: "CAR",
        quantity: "1",
        lineAmount: formatMoney(Number(o.amount), o.currency),
        productPriceGhs: listStr,
        depositPaidGhs: depositStr,
        outstandingGhs: outStr,
        customerName,
        customerEmail,
        customerPhone,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        paymentType: o.paymentType,
        deliveryMode: delivery,
        shippingFeeStatus: shipFee,
        orderCreated: created,
        dueOrEta,
        adminNotes,
        itemImageUrl: firstCarImageUrl(o.car),
      });
      continue;
    }
    if (o.partItems.length === 0) {
      out.push({
        orderReference: o.reference,
        itemTitle: "—",
        itemType: "PARTS",
        quantity: "0",
        lineAmount: formatMoney(Number(o.amount), o.currency),
        productPriceGhs: listStr,
        depositPaidGhs: depositStr,
        outstandingGhs: outStr,
        customerName,
        customerEmail,
        customerPhone,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        paymentType: o.paymentType,
        deliveryMode: delivery,
        shippingFeeStatus: shipFee,
        orderCreated: created,
        dueOrEta,
        adminNotes,
        itemImageUrl: "",
      });
      continue;
    }
    for (const li of o.partItems) {
      out.push({
        orderReference: o.reference,
        itemTitle: li.titleSnapshot.trim() || "—",
        itemType: "PARTS",
        quantity: String(li.quantity),
        lineAmount: formatMoney(Number(li.lineTotal), li.currency),
        productPriceGhs: formatMoney(Number(li.unitPrice) * li.quantity, li.currency),
        depositPaidGhs: depositStr,
        outstandingGhs: outStr,
        customerName,
        customerEmail,
        customerPhone,
        orderStatus: o.orderStatus,
        paymentStatus: String(pay),
        paymentType: o.paymentType,
        deliveryMode: delivery,
        shippingFeeStatus: shipFee,
        orderCreated: created,
        dueOrEta,
        adminNotes,
        itemImageUrl: firstPartLineImageUrl(li),
      });
    }
  }
  return out;
}

/** Legacy HTML table (Excel opens). Kept for old ?format=xls links. */
export function buildOrdersExportXlsHtml(lines: OrderExportLine[], filterLabel: string) {
  function escapeXml(s: string) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  const header = [
    "Order ref",
    "Item type",
    "Item title",
    "Qty",
    "Line amount",
    "Product price",
    "Deposit / paid",
    "Outstanding",
    "Item image URL",
    "Customer name",
    "Email",
    "Phone",
    "Order status",
    "Payment",
    "Payment type",
    "Delivery",
    "Shipping fee status",
    "Order date",
    "ETA / due note",
    "Admin notes",
  ];
  const trs = lines.map((r) => {
    return `<tr>
<td>${escapeXml(r.orderReference)}</td>
<td>${escapeXml(r.itemType)}</td>
<td>${escapeXml(r.itemTitle)}</td>
<td>${escapeXml(r.quantity)}</td>
<td>${escapeXml(r.lineAmount)}</td>
<td>${escapeXml(r.productPriceGhs)}</td>
<td>${escapeXml(r.depositPaidGhs)}</td>
<td>${escapeXml(r.outstandingGhs)}</td>
<td>${escapeXml(r.itemImageUrl)}</td>
<td>${escapeXml(r.customerName)}</td>
<td>${escapeXml(r.customerEmail)}</td>
<td>${escapeXml(r.customerPhone)}</td>
<td>${escapeXml(r.orderStatus)}</td>
<td>${escapeXml(r.paymentStatus)}</td>
<td>${escapeXml(r.paymentType)}</td>
<td>${escapeXml(r.deliveryMode)}</td>
<td>${escapeXml(r.shippingFeeStatus)}</td>
<td>${escapeXml(r.orderCreated)}</td>
<td>${escapeXml(r.dueOrEta)}</td>
<td>${escapeXml(r.adminNotes)}</td>
</tr>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<table border="1">
<tr><th colspan="20">Orders export — ${escapeXml(filterLabel)} (${lines.length} line${lines.length === 1 ? "" : "s"})</th></tr>
<tr>${header.map((h) => `<th>${escapeXml(h)}</th>`).join("")}</tr>
${trs.join("\n")}
</table>
</body></html>`;
}

export function buildOrdersExportXlsxBuffer(lines: OrderExportLine[], filterLabel: string): Buffer {
  const rows = lines.map((r) => ({
    orderRef: r.orderReference,
    itemType: r.itemType,
    itemTitle: r.itemTitle,
    quantity: r.quantity,
    lineAmount: r.lineAmount,
    productPrice: r.productPriceGhs,
    depositPaid: r.depositPaidGhs,
    outstanding: r.outstandingGhs,
    imageUrl: r.itemImageUrl,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    orderStatus: r.orderStatus,
    paymentStatus: r.paymentStatus,
    paymentType: r.paymentType,
    deliveryMode: r.deliveryMode,
    shippingFeeStatus: r.shippingFeeStatus,
    orderDate: r.orderCreated,
    etaDue: r.dueOrEta,
    adminNotes: r.adminNotes,
  }));
  const meta = [
    { key: "Report", value: "Orders export" },
    { key: "Scope", value: filterLabel },
    { key: "Generated", value: new Date().toISOString() },
    { key: "Row count", value: String(lines.length) },
  ];
  const wb = XLSX.utils.book_new();
  const wsMeta = XLSX.utils.json_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Info");
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

async function tryEmbedRemoteImage(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u, { signal: ctrl.signal, headers: { Accept: "image/*" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 6_000_000) return null;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    if (isPng) return doc.embedPng(buf);
    try {
      return await doc.embedJpg(buf);
    } catch {
      try {
        return await doc.embedPng(buf);
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

export async function buildOrdersExportPdf(
  lines: OrderExportLine[],
  filterLabel: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 28;
  const lineH = 11;
  const titleSize = 12;
  const bodySize = 7;
  const thumbW = 44;
  const thumbH = 44;
  const rowGap = 6;

  let page = doc.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - margin;

  const drawHeader = () => {
    page.drawText("Orders export", { x: margin, y, size: titleSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH * 1.5;
    page.drawText(filterLabel, { x: margin, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= lineH * 1.2;
    page.drawText(
      `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · ${lines.length} line${lines.length === 1 ? "" : "s"}`,
      { x: margin, y, size: 6, font, color: rgb(0.45, 0.45, 0.45) },
    );
    y -= lineH * 2;
  };

  drawHeader();

  for (const r of lines) {
    if (y < margin + thumbH + lineH * 8) {
      page = doc.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - margin;
      drawHeader();
    }

    const imgX = margin;
    const imgYTop = y;
    const embedded = await tryEmbedRemoteImage(doc, r.itemImageUrl);
    if (embedded) {
      const iw = embedded.width;
      const ih = embedded.height;
      const scale = Math.min(thumbW / iw, thumbH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const iy = y - dh;
      page.drawImage(embedded, { x: imgX, y: iy, width: dw, height: dh });
    } else {
      page.drawRectangle({
        x: imgX,
        y: y - thumbH,
        width: thumbW,
        height: thumbH,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.6,
        color: rgb(0.94, 0.94, 0.94),
      });
      page.drawText("No img", { x: imgX + 6, y: y - thumbH / 2 - 3, size: 5, font, color: rgb(0.5, 0.5, 0.5) });
    }

    const tx = margin + thumbW + 8;
    let ty = y;
    const linesBlock = [
      `${r.orderReference} · ${r.itemType} · ${r.itemTitle.slice(0, 72)}${r.itemTitle.length > 72 ? "…" : ""}`,
      `Qty ${r.quantity} · Line ${r.lineAmount} · List ${r.productPriceGhs} · Paid ${r.depositPaidGhs} · Out ${r.outstandingGhs}`,
      `${r.customerName} · ${r.customerEmail} · ${r.customerPhone}`,
      `Status ${r.orderStatus} · Pay ${r.paymentStatus} (${r.paymentType})`,
      `Delivery: ${r.deliveryMode.slice(0, 85)}`,
      `Shipping fee: ${r.shippingFeeStatus} · Date ${r.orderCreated} · ETA ${r.dueOrEta}`,
      r.adminNotes !== "—" ? `Notes: ${r.adminNotes.slice(0, 120)}${r.adminNotes.length > 120 ? "…" : ""}` : "",
    ].filter(Boolean);

    for (const line of linesBlock) {
      page.drawText(line, { x: tx, y: ty, size: bodySize, font, color: rgb(0.15, 0.15, 0.15) });
      ty -= lineH * 0.95;
    }

    y = Math.min(imgYTop - thumbH, ty) - rowGap;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.35,
      color: rgb(0.88, 0.88, 0.88),
    });
    y -= rowGap;
  }

  return doc.save();
}
