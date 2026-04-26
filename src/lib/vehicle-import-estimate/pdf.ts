import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

import type { VehicleImportEstimateRecord } from "./data";
import { formatEstimateMoney } from "./data";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { deriveDutyEstimate } from "@/lib/vehicle-import-estimate";

function drawLabelValue(page: PDFPage, x: number, y: number, label: string, value: string, bold: PDFFont, normal: PDFFont) {
  page.drawText(`${label}:`, { x, y, size: 10, font: bold, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(value, { x: x + 110, y, size: 10, font: normal, color: rgb(0.12, 0.12, 0.12) });
}

export async function buildVehicleImportEstimatePdf(estimate: VehicleImportEstimateRecord): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const dutyLogic = deriveDutyEstimate({
    fob: estimate.fob ?? undefined,
    freight: estimate.freight ?? undefined,
    insurance: estimate.insurance ?? undefined,
    cif: estimate.cif ?? undefined,
    estimatedDutyRangeMin: estimate.estimatedDutyRangeMin ?? undefined,
    estimatedDutyRangeMax: estimate.estimatedDutyRangeMax ?? undefined,
    estimatedLandedCost: estimate.estimatedLandedCost ?? undefined,
    engineType: estimate.engineType ?? undefined,
  });

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.98, 0.98, 0.99) });
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: 789.89, color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.93), borderWidth: 1.2 });

  let y = 780;
  page.drawText("SPARK AND DRIVE AUTOS", { x: 42, y, size: 16, font: bold, color: rgb(0.08, 0.55, 0.62) });
  y -= 20;
  page.drawText("Duty estimate (Ghana import)", { x: 42, y, size: 13, font: bold, color: rgb(0.12, 0.12, 0.12) });
  y -= 16;
  page.drawText(`Estimate No: ${estimate.estimateNumber}  |  Status: ${estimate.status}`, {
    x: 42,
    y,
    size: 9,
    font: normal,
    color: rgb(0.4, 0.4, 0.42),
  });

  y -= 26;
  page.drawText("Client Details", { x: 42, y, size: 11, font: bold, color: rgb(0.18, 0.18, 0.18) });
  y -= 16;
  drawLabelValue(page, 42, y, "Client name", estimate.clientName, bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "Contact", estimate.clientContact, bold, normal);

  y -= 24;
  page.drawText("Vehicle Details", { x: 42, y, size: 11, font: bold, color: rgb(0.18, 0.18, 0.18) });
  y -= 16;
  drawLabelValue(page, 42, y, "Vehicle name", estimate.vehicleName, bold, normal);
  y -= 14;
  drawLabelValue(
    page,
    42,
    y,
    "Powertrain",
    estimate.engineType ? engineTypeLabel(estimate.engineType) : "Not specified",
    bold,
    normal,
  );
  y -= 14;
  drawLabelValue(page, 42, y, "Model year", String(estimate.modelYear ?? "-"), bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "VIN", estimate.vin ?? "-", bold, normal);

  y -= 24;
  page.drawText("Cost Breakdown", { x: 42, y, size: 11, font: bold, color: rgb(0.18, 0.18, 0.18) });
  y -= 16;
  drawLabelValue(page, 42, y, "FOB", formatEstimateMoney(estimate.fob), bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "Freight", formatEstimateMoney(estimate.freight), bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "Insurance", formatEstimateMoney(estimate.insurance), bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "CIF", formatEstimateMoney(estimate.cif), bold, normal);

  y -= 24;
  page.drawText("Duty Estimate", { x: 42, y, size: 11, font: bold, color: rgb(0.18, 0.18, 0.18) });
  y -= 16;
  drawLabelValue(
    page,
    42,
    y,
    "Estimated duty range",
    `${formatEstimateMoney(estimate.estimatedDutyRangeMin)} - ${formatEstimateMoney(estimate.estimatedDutyRangeMax)}`,
    bold,
    normal,
  );
  y -= 14;
  drawLabelValue(page, 42, y, "Estimated landed cost", formatEstimateMoney(estimate.estimatedLandedCost), bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "Estimate mode", dutyLogic.mode, bold, normal);

  y -= 30;
  page.drawRectangle({ x: 40, y: y - 74, width: width - 80, height: 74, color: rgb(1, 0.97, 0.88), borderColor: rgb(0.95, 0.76, 0.34), borderWidth: 1 });
  page.drawText("IMPORTANT NOTICE", { x: 50, y: y - 16, size: 10, font: bold, color: rgb(0.7, 0.45, 0.08) });
  page.drawText(estimate.importantNotice ?? "", {
    x: 50,
    y: y - 34,
    size: 9.5,
    font: normal,
    color: rgb(0.35, 0.28, 0.11),
    maxWidth: width - 100,
    lineHeight: 12,
  });
  page.drawText(dutyLogic.uncertaintyNote, {
    x: 50,
    y: y - 62,
    size: 8.5,
    font: normal,
    color: rgb(0.4, 0.3, 0.12),
    maxWidth: width - 100,
    lineHeight: 11,
  });

  y -= 96;
  drawLabelValue(page, 42, y, "Prepared by", estimate.preparedByName, bold, normal);
  y -= 14;
  drawLabelValue(page, 42, y, "Created", new Date(estimate.createdAt).toLocaleString(), bold, normal);
  if (estimate.finalizedAt) {
    y -= 14;
    drawLabelValue(page, 42, y, "Finalized", new Date(estimate.finalizedAt).toLocaleString(), bold, normal);
  }

  return doc.save();
}
