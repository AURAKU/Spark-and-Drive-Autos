import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

import { resolveDutyDisclaimer } from "@/lib/duty/disclaimer";
import { customerConfidenceLabel } from "@/lib/duty-intelligence/result-labels";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { groupLineItems } from "@/lib/duty-intelligence/line-item-groups";
import { formatMoney } from "@/lib/format";

export type DutyEstimatePdfInput = {
  referenceNumber: string;
  customerName?: string;
  input: DutyCalculationInput;
  result: DutyIntelligenceResult;
  disclaimer?: string;
};

function drawRow(page: PDFPage, y: number, label: string, value: string, bold: PDFFont, normal: PDFFont, x = 42) {
  page.drawText(`${label}:`, { x, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.32) });
  page.drawText(value, { x: x + 120, y, size: 9, font: normal, color: rgb(0.1, 0.1, 0.12) });
}

export async function buildDutyEstimatePdf(params: DutyEstimatePdfInput): Promise<Uint8Array> {
  const { referenceNumber, customerName, input, result, disclaimer } = params;
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  let y = 780;

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.97, 0.98, 0.99) });
  page.drawRectangle({ x: 24, y: 24, width: 547.28, height: 793.89, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 1 });

  page.drawText("SPARK & DRIVE AUTOS", { x: 42, y, size: 14, font: bold, color: rgb(0.05, 0.45, 0.52) });
  y -= 18;
  page.drawText("Ghana Import Duty Estimate", { x: 42, y, size: 12, font: bold, color: rgb(0.12, 0.12, 0.14) });
  y -= 14;
  page.drawText("Planning estimate — not an official GRA / Customs document", { x: 42, y, size: 8, font: normal, color: rgb(0.45, 0.45, 0.48) });
  y -= 16;
  drawRow(page, y, "Reference", referenceNumber, bold, normal);
  y -= 12;
  if (customerName) {
    drawRow(page, y, "Prepared for", customerName, bold, normal);
    y -= 12;
  }
  drawRow(page, y, "Date", new Date(result.calculatedAt).toLocaleDateString("en-GB"), bold, normal);
  y -= 12;
  drawRow(page, y, "Confidence", customerConfidenceLabel(result.confidence.level), bold, normal);
  y -= 12;
  drawRow(page, y, "Rule set", result.ruleSetVersion ?? result.formulaVersion, bold, normal);
  y -= 20;

  page.drawText("Vehicle", { x: 42, y, size: 10, font: bold, color: rgb(0.15, 0.15, 0.17) });
  y -= 14;
  drawRow(page, y, "Make / model", `${input.vehicle.manufacturer} ${input.vehicle.model}`, bold, normal);
  y -= 12;
  drawRow(page, y, "Year", String(input.vehicle.year), bold, normal);
  y -= 12;
  drawRow(page, y, "Fuel type", input.vehicle.fuelType.replace(/_/g, " "), bold, normal);
  y -= 12;
  drawRow(page, y, "HS code", result.hsCode, bold, normal);
  y -= 20;

  page.drawText("Valuation summary", { x: 42, y, size: 10, font: bold, color: rgb(0.15, 0.15, 0.17) });
  y -= 14;
  drawRow(page, y, "FOB", formatMoney(result.summary.fobGhs), bold, normal);
  y -= 12;
  drawRow(page, y, "Freight", formatMoney(result.summary.freightGhs), bold, normal);
  y -= 12;
  drawRow(page, y, "Insurance", formatMoney(result.summary.insuranceGhs), bold, normal);
  y -= 12;
  drawRow(page, y, "CIF / customs value", formatMoney(result.summary.customsValueGhs), bold, normal);
  y -= 12;
  drawRow(page, y, "FX rate", `1 ${result.exchangeRate.fromCurrency} = ${result.exchangeRate.rate} GHS (${result.exchangeRate.source})`, bold, normal);
  y -= 20;

  page.drawText("Estimated duty & levies", { x: 42, y, size: 10, font: bold, color: rgb(0.15, 0.15, 0.17) });
  y -= 14;
  const groups = groupLineItems(result.lineItems);
  for (const g of groups) {
    if (g.group === "VALUATION") continue;
    for (const line of g.items) {
      if (y < 80) {
        page = doc.addPage([595.28, 841.89]);
        y = 780;
      }
      page.drawText(`${line.label}`, { x: 42, y, size: 8, font: normal, color: rgb(0.2, 0.2, 0.22) });
      page.drawText(formatMoney(line.amountGhs), { x: 480, y, size: 8, font: bold, color: rgb(0.1, 0.1, 0.12) });
      y -= 11;
    }
  }

  y -= 8;
  page.drawRectangle({ x: 42, y: y - 4, width: 511, height: 36, color: rgb(0.94, 0.97, 0.98), borderColor: rgb(0.7, 0.85, 0.9), borderWidth: 0.5 });
  y -= 2;
  drawRow(page, y, "Estimated duty total", formatMoney(result.summary.totalGraTaxesGhs), bold, normal);
  y -= 12;
  if (result.estimateRange) {
    drawRow(
      page,
      y,
      "Range",
      `${formatMoney(result.estimateRange.lowGhs ?? result.summary.totalGraTaxesGhs)} – ${formatMoney(result.estimateRange.highGhs ?? result.summary.totalGraTaxesGhs)}`,
      bold,
      normal,
    );
    y -= 12;
  }
  drawRow(page, y, "Est. landed cost", formatMoney(result.summary.totalLandedCostGhs), bold, normal);
  y -= 24;

  const disclaimerText = resolveDutyDisclaimer(disclaimer);
  const words = disclaimerText.split(/\s+/);
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 95) {
      page.drawText(line, { x: 42, y, size: 7, font: normal, color: rgb(0.4, 0.4, 0.42), maxWidth: 511 });
      y -= 10;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(line, { x: 42, y, size: 7, font: normal, color: rgb(0.4, 0.4, 0.42), maxWidth: 511 });
  }

  page.drawText("Prepared by Spark & Drive Autos — sparkanddriveautos.com", {
    x: 42,
    y: 36,
    size: 7,
    font: normal,
    color: rgb(0.5, 0.5, 0.52),
  });

  return doc.save();
}
