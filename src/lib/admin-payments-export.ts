import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

import { settlementMethodLabel } from "@/lib/payment-settlement";

const EXPORT_LIMIT = 2000;

export async function fetchPaymentsForIntelExport(where: Prisma.PaymentWhereInput) {
  return prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: {
      user: { select: { email: true } },
      order: { select: { reference: true } },
    },
  });
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPaymentsIntelExportXlsHtml(rows: Awaited<ReturnType<typeof fetchPaymentsForIntelExport>>, label: string) {
  const header = ["Status", "Channel", "Amount", "Currency", "Customer", "Order ref", "Provider ref", "Created"];
  const trs = rows.map((p) => {
    const created = p.createdAt.toISOString().slice(0, 19);
    return `<tr>
<td>${escapeXml(p.status)}</td>
<td>${escapeXml(settlementMethodLabel(p.settlementMethod))}</td>
<td>${escapeXml(String(Number(p.amount)))}</td>
<td>${escapeXml(p.currency)}</td>
<td>${escapeXml(p.user?.email ?? "—")}</td>
<td>${escapeXml(p.order?.reference ?? "—")}</td>
<td>${escapeXml(p.providerReference ?? "—")}</td>
<td>${escapeXml(created)}</td>
</tr>`;
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<table border="1">
<tr><th colspan="8">Payment intelligence — ${escapeXml(label)} (${rows.length} row${rows.length === 1 ? "" : "s"})</th></tr>
<tr>${header.map((h) => `<th>${escapeXml(h)}</th>`).join("")}</tr>
${trs.join("\n")}
</table>
</body></html>`;
}

export async function buildPaymentsIntelExportPdf(
  rows: Awaited<ReturnType<typeof fetchPaymentsForIntelExport>>,
  label: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 36;
  const lineH = 9;
  const titleSize = 12;
  const bodySize = 7;

  let page = doc.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - margin;

  const drawHeader = () => {
    page.drawText("Payment intelligence", { x: margin, y, size: titleSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH * 1.6;
    page.drawText(label, { x: margin, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= lineH * 1.4;
    page.drawText(`Exported ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · ${rows.length} payments (max ${EXPORT_LIMIT})`, {
      x: margin,
      y,
      size: 6,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    y -= lineH * 2;
  };

  drawHeader();

  const cols = [
    { w: 52, label: "Status" },
    { w: 72, label: "Channel" },
    { w: 48, label: "Amount" },
    { w: 88, label: "Customer" },
    { w: 52, label: "Order" },
    { w: 62, label: "Created" },
  ] as const;

  const truncate = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

  const tableHeader = () => {
    let x = margin;
    for (const c of cols) {
      page.drawText(c.label, { x, y, size: bodySize, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
      x += c.w;
    }
    y -= lineH * 1.2;
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: width - margin, y: y + 2 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= lineH * 0.4;
  };

  tableHeader();

  for (const p of rows) {
    if (y < margin + lineH * 10) {
      page = doc.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - margin;
      drawHeader();
      tableHeader();
    }
    const cells = [
      truncate(p.status.replaceAll("_", " "), 10),
      truncate(settlementMethodLabel(p.settlementMethod), 18),
      truncate(formatMoney(Number(p.amount), p.currency), 12),
      truncate(p.user?.email ?? "—", 22),
      truncate(p.order?.reference ?? "—", 10),
      p.createdAt.toISOString().slice(0, 10),
    ];
    let x = margin;
    for (let i = 0; i < cols.length; i++) {
      page.drawText(cells[i], { x, y, size: bodySize, font, color: rgb(0.2, 0.2, 0.2) });
      x += cols[i].w;
    }
    y -= lineH * 1.1;
  }

  return doc.save();
}
