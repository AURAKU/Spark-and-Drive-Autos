import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import { formatReportMoney, type DutyReportData } from "@/lib/duty-intelligence/report-model";

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0.12, 0.12, 0.14),
) {
  const safe = text.replace(/[^\x20-\x7E]/g, "?");
  page.drawText(safe.slice(0, 110), { x, y, size, font, color });
}

export async function buildDutyIntelligenceReportPdf(report: DutyReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595.28, 841.89]);
  const margin = 42;
  let y = 790;

  try {
    const logoPath = path.join(process.cwd(), "public/brand/logo-emblem.png");
    const logoBytes = await readFile(logoPath);
    const logo = await doc.embedPng(logoBytes);
    const logoDims = logo.scale(0.18);
    page.drawImage(logo, { x: margin, y: y - logoDims.height + 8, width: logoDims.width, height: logoDims.height });
  } catch {
    // Logo optional — brand text remains.
  }

  drawText(page, "SPARK & DRIVE AUTOS", margin + 70, y, 14, bold, rgb(0.08, 0.45, 0.52));
  y -= 18;
  drawText(page, "Vehicle Duty & Landed Cost Estimate", margin + 70, y, 11, bold);
  y -= 14;
  drawText(page, `Reference: ${report.reportReference}`, margin + 70, y, 9, normal, rgb(0.35, 0.35, 0.38));
  y -= 12;
  drawText(
    page,
    `Generated: ${new Date(report.generatedAt).toLocaleString("en-GH")}`,
    margin + 70,
    y,
    9,
    normal,
    rgb(0.35, 0.35, 0.38),
  );

  y -= 28;
  page.drawLine({ start: { x: margin, y }, end: { x: 553, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });
  y -= 22;

  const ensureSpace = (need: number) => {
    if (y - need < 50) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
  };

  const section = (title: string) => {
    ensureSpace(40);
    drawText(page, title, margin, y, 11, bold);
    y -= 16;
  };

  const row = (label: string, value: string) => {
    ensureSpace(18);
    drawText(page, label, margin, y, 9, normal, rgb(0.4, 0.4, 0.42));
    drawText(page, value, margin + 160, y, 9, normal);
    y -= 14;
  };

  section("Vehicle details");
  const v = report.vehicle;
  if (v.make) row("Make", v.make);
  if (v.model) row("Model", v.model);
  if (v.manufactureYear != null) row("Year", String(v.manufactureYear));
  if (v.fuelType) row("Powertrain", v.fuelType);
  if (v.engineCc != null) row("Engine capacity", `${v.engineCc} cc`);
  if (v.powerKw != null) row("Power", `${v.powerKw} kW`);
  if (v.transmission) row("Transmission", v.transmission);
  if (v.drivetrain) row("Drivetrain", v.drivetrain);
  if (v.vehicleCategory) row("Category", v.vehicleCategory);
  if (v.hsCode) row("HS code", v.hsCode);
  if (v.originCountry) row("Origin", v.originCountry);
  if (v.vinOrChassisMasked) row("VIN / chassis", v.vinOrChassisMasked);

  y -= 6;
  section("Cost & valuation (GHS)");
  const c = report.costInputs;
  row("Purchase currency", c.purchaseCurrency);
  row("FOB (foreign)", `${c.purchaseCurrency} ${c.fobForeign.toFixed(2)}`);
  row("FX rate", `1 ${c.purchaseCurrency} = ${c.fxRate} GHS`);
  if (c.fxSource) row("FX source", c.fxSource);
  if (c.fxEffectiveDate) row("FX effective date", c.fxEffectiveDate);
  row("FOB (GHS)", formatReportMoney(c.fobGhs));
  row("Freight (GHS)", formatReportMoney(c.freightGhs));
  row("Insurance (GHS)", formatReportMoney(c.insuranceGhs));
  row("CIF (GHS)", formatReportMoney(c.cifGhs));
  row("Customs value (GHS)", formatReportMoney(c.customsValueGhs));

  y -= 6;
  section("Duty & charge breakdown");
  for (const group of report.dutyGroups) {
    ensureSpace(24);
    drawText(page, group.heading, margin, y, 10, bold, rgb(0.2, 0.2, 0.22));
    y -= 14;
    for (const line of group.lines) {
      ensureSpace(16);
      const rate = line.rateLabel ? ` @ ${line.rateLabel}` : "";
      drawText(page, `${line.chargeName}${rate}`, margin, y, 8, normal);
      drawText(page, formatReportMoney(line.payableAmount), 430, y, 8, normal);
      y -= 12;
    }
    y -= 4;
  }

  y -= 4;
  section("Totals");
  row("Estimated duty payable", formatReportMoney(report.totals.estimatedDutyPayableGhs));
  row("Estimated landed cost", formatReportMoney(report.totals.estimatedLandedCostGhs));
  if (report.totals.lowEstimateGhs != null) row("Low estimate", formatReportMoney(report.totals.lowEstimateGhs));
  if (report.totals.expectedEstimateGhs != null) {
    row("Expected estimate", formatReportMoney(report.totals.expectedEstimateGhs));
  }
  if (report.totals.highEstimateGhs != null) row("High estimate", formatReportMoney(report.totals.highEstimateGhs));

  y -= 6;
  section("Confidence");
  row("Label", report.confidence.label);
  if (report.confidence.score != null) row("Score", String(report.confidence.score));

  y -= 6;
  section("Disclaimer");
  ensureSpace(60);
  const words = report.disclaimer.split(/\s+/);
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > 95) {
      drawText(page, line, margin, y, 8, normal, rgb(0.35, 0.35, 0.38));
      y -= 11;
      ensureSpace(20);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) {
    drawText(page, line, margin, y, 8, normal, rgb(0.35, 0.35, 0.38));
    y -= 14;
  }

  ensureSpace(40);
  drawText(page, `Prepared by: ${report.preparedBy}`, margin, y, 9, bold);
  y -= 12;
  drawText(page, report.website, margin, y, 8, normal, rgb(0.35, 0.35, 0.38));
  if (report.ruleSetVersion) {
    y -= 12;
    drawText(page, `Rule set: ${report.ruleSetVersion}`, margin, y, 8, normal, rgb(0.35, 0.35, 0.38));
  }

  return doc.save();
}

export function dutyReportPdfFilename(reference: string): string {
  const safe = reference.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 48);
  return `Spark-Drive-Duty-Estimate-${safe || "report"}.pdf`;
}
