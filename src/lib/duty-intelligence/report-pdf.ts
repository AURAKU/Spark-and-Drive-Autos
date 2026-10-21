import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import { formatSheetNumber, type DutyReportData } from "@/lib/duty-intelligence/report-model";
import { LEGAL_COMPANY } from "@/lib/legal";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const INK = rgb(0.07, 0.08, 0.1);
const MUTED = rgb(0.38, 0.39, 0.42);
const LINE = rgb(0.82, 0.83, 0.85);
const TEAL = rgb(0.04, 0.42, 0.45);

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const safe = text.replace(/[^\x20-\x7E]/g, " ");
  page.drawText(safe, { x, y, size, font, color });
}

function wrapWords(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildDutyIntelligenceReportPdf(report: DutyReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 36;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 42;
  };

  const ensureSpace = (need: number) => {
    if (y - need < 48) newPage();
  };

  const generatedLabel = (() => {
    try {
      return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(report.generatedAt));
    } catch {
      return report.generatedAt.slice(0, 10);
    }
  })();

  drawText(page, report.reportReference, MARGIN, y, 8, normal, MUTED);
  const dateWidth = normal.widthOfTextAtSize(generatedLabel, 8);
  drawText(page, generatedLabel, PAGE_WIDTH - MARGIN - dateWidth, y, 8, normal, MUTED);
  y -= 28;

  const title = report.vehicleTitle;
  const titleSize = title.length > 42 ? 14 : 16;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  drawText(page, title, (PAGE_WIDTH - titleWidth) / 2, y, titleSize, bold);
  y -= 22;

  try {
    const logoPath = path.join(process.cwd(), "public/brand/logo-emblem.png");
    const logoBytes = await readFile(logoPath);
    const logo = await doc.embedPng(logoBytes);
    const size = 72;
    const x = (PAGE_WIDTH - size) / 2;
    page.drawCircle({
      x: PAGE_WIDTH / 2,
      y: y - size / 2,
      size: size / 2 + 4,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.86, 0.87, 0.88),
      borderWidth: 1,
    });
    page.drawImage(logo, { x, y: y - size, width: size, height: size });
    y -= size + 14;
  } catch {
    y -= 8;
  }

  const brand = report.company.brandName;
  const brandWidth = bold.widthOfTextAtSize(brand, 11);
  drawText(page, brand, (PAGE_WIDTH - brandWidth) / 2, y, 11, bold);
  y -= 14;
  const host = report.company.websiteHost;
  const hostWidth = normal.widthOfTextAtSize(host, 9);
  drawText(page, host, (PAGE_WIDTH - hostWidth) / 2, y, 9, normal, TEAL);
  y -= 20;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: LINE });
  y -= 16;

  const chips = report.specChips.slice(0, 6);
  if (chips.length > 0) {
    const colW = (PAGE_WIDTH - MARGIN * 2) / chips.length;
    chips.forEach((chip, i) => {
      const cx = MARGIN + i * colW;
      drawText(page, chip.label.toUpperCase(), cx, y, 7, bold, MUTED);
      drawText(page, chip.value, cx, y - 12, 9, normal);
    });
    y -= 28;
  }

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: LINE });
  y -= 16;

  if (report.vehicle.vinOrChassisMasked) {
    const vin = report.vehicle.vinOrChassisMasked;
    const vinWidth = normal.widthOfTextAtSize(vin, 8);
    drawText(page, vin, (PAGE_WIDTH - vinWidth) / 2, y, 8, normal, MUTED);
    y -= 18;
  }

  if (report.customer.name || report.customer.email || report.customer.phone) {
    drawText(page, "PREPARED FOR", MARGIN, y, 8, bold, MUTED);
    y -= 13;
    if (report.customer.name) {
      drawText(page, report.customer.name, MARGIN, y, 9, normal);
      y -= 12;
    }
    if (report.customer.email) {
      drawText(page, report.customer.email, MARGIN, y, 9, normal);
      y -= 12;
    }
    if (report.customer.phone) {
      drawText(page, report.customer.phone, MARGIN, y, 9, normal);
      y -= 12;
    }
    y -= 6;
  }

  drawText(page, "Taxes & Duty Payable", MARGIN, y, 12, bold);
  y -= 18;

  const cols = {
    no: MARGIN,
    desc: MARGIN + 28,
    base: 360,
    rate: 440,
    pay: 515,
  };

  drawText(page, "#", cols.no, y, 8, bold, MUTED);
  drawText(page, "DESCRIPTOR", cols.desc, y, 8, bold, MUTED);
  drawText(page, "BASE AMOUNT", cols.base, y, 8, bold, MUTED);
  drawText(page, "RATE", cols.rate, y, 8, bold, MUTED);
  drawText(page, "PAYABLE", cols.pay, y, 8, bold, MUTED);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.7, color: LINE });
  y -= 14;

  if (report.dutyLines.length === 0) {
    drawText(page, "No charge lines were recorded for this calculation.", MARGIN, y, 9, normal, MUTED);
    y -= 16;
  }

  for (const line of report.dutyLines) {
    ensureSpace(16);
    drawText(page, line.lineNo, cols.no, y, 8, normal, MUTED);
    const name = line.chargeName.length > 42 ? `${line.chargeName.slice(0, 41)}.` : line.chargeName;
    drawText(page, name, cols.desc, y, 8, normal);
    const base = formatSheetNumber(line.taxableBaseAmount);
    const rate = line.rateLabel ?? "1.00";
    const payable = formatSheetNumber(line.payableAmount);
    drawText(page, base, cols.base + 52 - normal.widthOfTextAtSize(base, 8), y, 8, normal);
    drawText(page, rate, cols.rate + 36 - normal.widthOfTextAtSize(rate, 8), y, 8, normal);
    drawText(page, payable, PAGE_WIDTH - MARGIN - normal.widthOfTextAtSize(payable, 8), y, 8, bold);
    y -= 13;
  }

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: LINE });
  y -= 20;

  const totalLabel = "Total payable (GHS)";
  const totalLabelWidth = bold.widthOfTextAtSize(totalLabel, 9);
  drawText(page, totalLabel, PAGE_WIDTH - MARGIN - totalLabelWidth, y, 9, bold, MUTED);
  y -= 18;
  const total = formatSheetNumber(report.totals.estimatedDutyPayableGhs);
  const totalWidth = bold.widthOfTextAtSize(total, 20);
  drawText(page, total, PAGE_WIDTH - MARGIN - totalWidth, y, 20, bold);
  y -= 16;
  if (report.totals.estimatedDutyPayableUsd != null) {
    const usd = `USD ${formatSheetNumber(report.totals.estimatedDutyPayableUsd)}`;
    const usdWidth = normal.widthOfTextAtSize(usd, 10);
    drawText(page, usd, PAGE_WIDTH - MARGIN - usdWidth, y, 10, normal, MUTED);
    y -= 16;
  }

  ensureSpace(70);
  y -= 6;
  drawText(page, "VALUATION USED", MARGIN, y, 8, bold, MUTED);
  y -= 14;
  const valuation = [
    ["FOB", formatSheetNumber(report.costInputs.fobGhs)],
    ["Freight", formatSheetNumber(report.costInputs.freightGhs)],
    ["Insurance", formatSheetNumber(report.costInputs.insuranceGhs)],
    ["CIF / assessed value", formatSheetNumber(report.costInputs.customsValueGhs)],
  ];
  for (const [label, value] of valuation) {
    drawText(page, label, MARGIN, y, 8, normal, MUTED);
    drawText(page, value, MARGIN + 160, y, 8, normal);
    y -= 12;
  }

  ensureSpace(90);
  y -= 8;
  drawText(page, "DISCLAIMER", MARGIN, y, 8, bold, MUTED);
  y -= 13;
  const disclaimerParts = [
    report.disclaimer,
    ...report.disclaimerLong,
    `Prepared by ${report.company.brandName} (${report.company.legalName}, ${report.company.registrationNumber}). Office: ${report.company.address}. ${LEGAL_COMPANY.phone}. ${report.company.websiteHost}. Ghana Customs determines the final duty and other government charges at clearance. This document is a planning estimate only and is not a Customs assessment.`,
  ];
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  for (const para of disclaimerParts) {
    for (const line of wrapWords(para, normal, 7.5, maxWidth)) {
      ensureSpace(12);
      drawText(page, line, MARGIN, y, 7.5, normal, MUTED);
      y -= 10;
    }
    y -= 4;
  }

  return doc.save();
}

export function dutyReportPdfFilename(reference: string): string {
  const safe = reference.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 48);
  return `Spark-Drive-Duty-Estimate-${safe || "report"}.pdf`;
}
