import { readFile, mkdir, writeFile } from "fs/promises";
import path from "path";

import type { Order, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getReceiptTemplate, type ReceiptScope } from "@/lib/receipt-template";

type ReceiptLineItem = {
  label: string;
  value: string;
};

type RenderReceiptInput = {
  scope: ReceiptScope;
  receiptReference: string;
  customerName?: string | null;
  lines: ReceiptLineItem[];
  generatedAt?: Date;
};

export function createReceiptReference(prefix = "SDA-RCP") {
  return `${prefix}-${nanoid(10).toUpperCase()}`;
}

function formatStamp(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function toRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return rgb(0.19, 0.71, 0.78);
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(text: string, maxChars = 100): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (trial.length <= maxChars) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

async function loadLogoBytes(scope: ReceiptScope): Promise<Uint8Array | null> {
  // Only paths under the deployed repo (public/ is copied into .next for runtime reads via cwd).
  const candidates =
    scope === "CAR"
      ? [path.join(process.cwd(), "public", "brand", "logo-emblem.png")]
      : [
          path.join(process.cwd(), "public", "brand", "gear-storefront-theme.png"),
          path.join(process.cwd(), "public", "brand", "logo-emblem.png"),
        ];
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      return new Uint8Array(bytes);
    } catch {
      continue;
    }
  }
  return null;
}

export async function buildReceiptPdf(input: RenderReceiptInput): Promise<{ pdfBytes: Uint8Array; templateData: Prisma.JsonObject }> {
  const template = await getReceiptTemplate(input.scope);
  const now = input.generatedAt ?? new Date();
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const accent = toRgb(template.accentColor);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.97, 0.97) });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, color: rgb(1, 1, 1), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1 });

  let cursorY = height - 80;
  const logoBytes = await loadLogoBytes(input.scope);
  if (logoBytes) {
    let img;
    try {
      img = await doc.embedPng(logoBytes);
    } catch {
      img = await doc.embedJpg(logoBytes);
    }
    const cardW = 430;
    const cardH = 170;
    const cardX = (width - cardW) / 2;
    const cardY = cursorY - cardH + 10;
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      color: rgb(0.05, 0.05, 0.06),
    });
    const logoW = input.scope === "CAR" ? 300 : 340;
    const scale = logoW / img.width;
    const logoH = img.height * scale;
    page.drawImage(img, {
      x: (width - logoW) / 2,
      y: cardY + (cardH - logoH) / 2,
      width: logoW,
      height: logoH,
    });
    cursorY = cardY - 34;
  }

  page.drawText(template.companyName.toUpperCase(), {
    x: 60,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: accent,
  });
  cursorY -= 28;
  page.drawText(template.heading.toUpperCase(), {
    x: 60,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 18;
  page.drawText(template.subheading, {
    x: 60,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  cursorY -= 22;

  const customerText = `Customer Name: ${input.customerName?.trim() || "N/A"}`;
  page.drawText(customerText, { x: 60, y: cursorY, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  cursorY -= 14;
  page.drawText(`Date: ${formatStamp(now)}   |   Receipt Ref: ${input.receiptReference}`, {
    x: 60,
    y: cursorY,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  cursorY -= 22;

  // Table
  const tableX = 60;
  const tableWidth = width - 120;
  const rowHeight = 28;
  const leftW = 200;
  const rows = input.lines.length;
  const tableHeight = rows * rowHeight;
  page.drawRectangle({
    x: tableX,
    y: cursorY - tableHeight,
    width: tableWidth,
    height: tableHeight,
    borderColor: accent,
    borderWidth: 1.2,
    color: rgb(0.99, 0.99, 0.99),
  });
  page.drawLine({
    start: { x: tableX + leftW, y: cursorY },
    end: { x: tableX + leftW, y: cursorY - tableHeight },
    color: rgb(0.82, 0.82, 0.82),
    thickness: 1,
  });
  for (let i = 1; i < rows; i += 1) {
    const y = cursorY - i * rowHeight;
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableWidth, y }, color: rgb(0.88, 0.88, 0.88), thickness: 1 });
  }
  input.lines.forEach((line, i) => {
    const y = cursorY - rowHeight * i - 18;
    if (i % 2 === 0) {
      page.drawRectangle({
        x: tableX,
        y: cursorY - rowHeight * (i + 1),
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.97, 0.98, 0.99),
      });
    }
    page.drawText(line.label, { x: tableX + 8, y, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(line.value, { x: tableX + leftW + 8, y, size: 10, font, color: rgb(0.18, 0.18, 0.18) });
  });
  cursorY -= tableHeight + 24;

  for (const ln of wrapText(template.disclaimer, 112)) {
    page.drawText(ln, { x: 60, y: cursorY, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
    cursorY -= 13;
  }
  cursorY -= 12;
  page.drawText(`Contact: ${template.contactPhone}`, { x: 60, y: cursorY, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
  cursorY -= 14;
  page.drawText(`Email: ${template.contactEmail}`, { x: 60, y: cursorY, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  cursorY -= 14;
  page.drawText(`Office: ${template.officeAddress}`, { x: 60, y: cursorY, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  cursorY -= 26;

  if (template.showSignature) {
    page.drawText(`${template.signatureLabel}: _________________________________`, {
      x: 60,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    cursorY -= 30;
  }

  page.drawLine({
    start: { x: 60, y: cursorY + 12 },
    end: { x: width - 60, y: cursorY + 12 },
    color: rgb(0.9, 0.9, 0.9),
    thickness: 1,
  });
  page.drawText(template.thankYouNote, { x: 60, y: cursorY - 2, size: 11, font: fontBold, color: accent });

  const pdfBytes = await doc.save();
  const templateData: Prisma.JsonObject = {
    templateId: template.id,
    templateScope: template.scope,
    companyName: template.companyName,
    heading: template.heading,
    subheading: template.subheading,
    contactPhone: template.contactPhone,
    contactEmail: template.contactEmail,
    officeAddress: template.officeAddress,
    disclaimer: template.disclaimer,
    thankYouNote: template.thankYouNote,
    signatureLabel: template.signatureLabel,
    accentColor: template.accentColor,
    showSignature: template.showSignature,
    generatedAt: now.toISOString(),
  };
  return { pdfBytes, templateData };
}

export async function persistReceiptPdf(receiptReference: string, pdfBytes: Uint8Array): Promise<string> {
  const folder = path.join(process.cwd(), "public", "receipts");
  await mkdir(folder, { recursive: true });
  const fileName = `${receiptReference}.pdf`;
  const filePath = path.join(folder, fileName);
  await writeFile(filePath, Buffer.from(pdfBytes));
  return `/receipts/${fileName}`;
}

export function makeCarReceiptLines(input: {
  carTitle: string;
  totalCarCostGhs: number;
  depositPaidGhs: number;
  additionalAmountPaid?: string;
  outstandingBalanceGhs: number;
  paymentStatusLabel: string;
}): ReceiptLineItem[] {
  return [
    { label: "Vehicle", value: input.carTitle },
    { label: "Total Car Cost (GHS)", value: input.totalCarCostGhs.toLocaleString("en-GH") },
    { label: "Deposit Paid (GHS)", value: input.depositPaidGhs.toLocaleString("en-GH") },
    { label: "Additional Amount Paid", value: input.additionalAmountPaid ?? "—" },
    { label: "Outstanding Balance (GHS)", value: input.outstandingBalanceGhs.toLocaleString("en-GH") },
    { label: "Payment Status", value: input.paymentStatusLabel },
  ];
}

export function makePartsReceiptLines(input: {
  orderReference?: string;
  items: Array<{ title: string; quantity: number; total: number }>;
  totalPaidGhs: number;
  paymentStatusLabel: string;
}): ReceiptLineItem[] {
  const head = input.items.slice(0, 4).map((i, idx) => ({
    label: `Item ${idx + 1}`,
    value: `${i.title} × ${i.quantity}`,
  }));
  const more = input.items.length > 4 ? [{ label: "Additional lines", value: `${input.items.length - 4} more item(s)` }] : [];
  return [
    { label: "Order Reference", value: input.orderReference ?? "—" },
    { label: "Order Type", value: "Parts & accessories purchase" },
    ...head,
    ...more,
    { label: "Total Paid (GHS)", value: input.totalPaidGhs.toLocaleString("en-GH") },
    { label: "Payment Status", value: input.paymentStatusLabel },
  ];
}

export async function generateAndPersistOrderReceiptPdf(input: {
  scope: ReceiptScope;
  order: Pick<Order, "receiptReference"> & { reference: string; amount: Prisma.Decimal | number };
  customerName?: string | null;
  lines: ReceiptLineItem[];
}): Promise<{ receiptPdfUrl: string; templateData: Prisma.JsonObject; receiptReference: string }> {
  const receiptReference = input.order.receiptReference || createReceiptReference(input.scope === "CAR" ? "SDA-CAR-RCP" : "SDA-PART-RCP");
  const { pdfBytes, templateData } = await buildReceiptPdf({
    scope: input.scope,
    receiptReference,
    customerName: input.customerName,
    lines: input.lines,
  });
  const receiptPdfUrl = await persistReceiptPdf(receiptReference, pdfBytes);
  return { receiptPdfUrl, templateData, receiptReference };
}
