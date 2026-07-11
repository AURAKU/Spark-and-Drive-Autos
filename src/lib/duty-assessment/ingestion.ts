import type { Prisma, PrismaClient } from "@prisma/client";

import { normalizeChargeName } from "./charge-normalization";
import {
  buildAssessmentIdentityHash,
  hashImporterIdentifier,
  normalizeHsCode,
} from "./identity";
import { reconcileAssessmentLines, sumLinePayables } from "./reconciliation";
import type {
  AssessmentLineInput,
  AttachReceiptResult,
  BillOfEntryIngestInput,
  IngestBillOfEntryResult,
  PaymentReceiptIngestInput,
  VehicleProfileInput,
} from "./types";

type DbClient = PrismaClient | Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function upsertVehicleProfile(
  db: DbClient,
  input: VehicleProfileInput,
  createdById?: string,
): Promise<{ id: string }> {
  const hsCodeNormalized = normalizeHsCode(input.hsCode);

  if (input.chassis) {
    const byChassis = await db.dutyVehicleProfile.findFirst({
      where: { chassis: input.chassis },
      select: { id: true },
    });
    if (byChassis) {
      return db.dutyVehicleProfile.update({
        where: { id: byChassis.id },
        data: {
          make: input.make,
          model: input.model,
          manufacturerModel: input.manufacturerModel,
          vin: input.vin,
          manufactureYear: input.manufactureYear,
          manufactureMonth: input.manufactureMonth,
          firstRegistrationDate: input.firstRegistrationDate,
          vehicleCategory: input.vehicleCategory,
          fuelType: input.fuelType,
          engineCc: input.engineCc,
          powerKw: input.powerKw,
          cylinders: input.cylinders,
          seats: input.seats,
          grossWeightKg: input.grossWeightKg,
          netWeightKg: input.netWeightKg,
          hsCode: input.hsCode,
          hsCodeNormalized,
          countryOfOrigin: input.countryOfOrigin,
          countryOfExport: input.countryOfExport,
        },
        select: { id: true },
      });
    }
  }

  return db.dutyVehicleProfile.create({
    data: {
      make: input.make,
      model: input.model,
      manufacturerModel: input.manufacturerModel,
      vin: input.vin,
      chassis: input.chassis,
      manufactureYear: input.manufactureYear,
      manufactureMonth: input.manufactureMonth,
      firstRegistrationDate: input.firstRegistrationDate,
      vehicleCategory: input.vehicleCategory,
      fuelType: input.fuelType,
      engineCc: input.engineCc,
      powerKw: input.powerKw,
      cylinders: input.cylinders,
      seats: input.seats,
      grossWeightKg: input.grossWeightKg,
      netWeightKg: input.netWeightKg,
      hsCode: input.hsCode,
      hsCodeNormalized,
      countryOfOrigin: input.countryOfOrigin,
      countryOfExport: input.countryOfExport,
      createdById,
    },
    select: { id: true },
  });
}

function mapLinesForInsert(
  lines: AssessmentLineInput[],
  sourceDocumentKind?: BillOfEntryIngestInput["document"] extends infer D
    ? D extends { documentKind: infer K }
      ? K
      : never
    : never,
  flags?: { matchedReceiptLine?: boolean; unmatchedReceipt?: boolean },
) {
  return lines.map((line, index) => ({
    chargeCode: line.chargeCode,
    chargeName: line.chargeName,
    normalizedChargeKey: normalizeChargeName(line.chargeName),
    externalTaxCode: line.externalTaxCode,
    taxBaseCode: line.taxBaseCode,
    displayedBaseAmount: line.displayedBaseAmount,
    displayedRate: line.displayedRate,
    amountExempted: line.amountExempted,
    amountSuspended: line.amountSuspended,
    amountPayable: line.amountPayable,
    displayOrder: line.displayOrder ?? index + 1,
    sourcePage: line.sourcePage,
    sourceRow: line.sourceRow,
    sourceDocumentKind: line.sourceDocumentKind ?? sourceDocumentKind,
    matchedReceiptLine: flags?.matchedReceiptLine ?? false,
    unmatchedReceipt: flags?.unmatchedReceipt ?? false,
  }));
}

export async function findAssessmentByIdentity(
  db: DbClient,
  input: {
    billOfEntryNumber?: string;
    customsOffice?: string;
    declarationReference?: string;
    assessmentDate?: Date;
    totalAssessedGhs?: number;
    totalPaidGhs?: number;
    importerIdentifier?: string;
  },
) {
  const documentIdentityHash = buildAssessmentIdentityHash(input);

  const byHash = await db.dutyAssessment.findUnique({
    where: { documentIdentityHash },
    include: { lines: true },
  });
  if (byHash) return byHash;

  if (input.billOfEntryNumber && input.customsOffice) {
    return db.dutyAssessment.findFirst({
      where: {
        billOfEntryNumber: input.billOfEntryNumber,
        customsOffice: input.customsOffice,
      },
      include: { lines: true },
    });
  }

  return null;
}

export async function ingestBillOfEntry(
  db: DbClient,
  input: BillOfEntryIngestInput,
  actorId?: string,
): Promise<IngestBillOfEntryResult> {
  const lineTotal = sumLinePayables(input.lines);
  if (Math.abs(lineTotal - input.totalAssessedGhs) > 0.02) {
    throw new Error(
      `Line total ${lineTotal.toFixed(2)} does not match totalAssessedGhs ${input.totalAssessedGhs.toFixed(2)}`,
    );
  }

  const identity = buildAssessmentIdentityHash({
    billOfEntryNumber: input.billOfEntryNumber,
    customsOffice: input.customsOffice,
    declarationReference: input.declarationReference,
    assessmentDate: input.assessmentDate,
    totalAssessedGhs: input.totalAssessedGhs,
    importerIdentifier: input.importerIdentifier,
  });

  const existing = await db.dutyAssessment.findUnique({ where: { documentIdentityHash: identity } });
  if (existing) {
    return {
      assessmentId: existing.id,
      vehicleProfileId: existing.vehicleProfileId,
      lineCount: await db.dutyAssessmentLine.count({ where: { assessmentId: existing.id } }),
      totalAssessedGhs: Number(existing.totalAssessedGhs),
      duplicatePrevented: true,
    };
  }

  const vehicleProfile = await upsertVehicleProfile(db, input.vehicle, actorId);

  const assessment = await db.dutyAssessment.create({
    data: {
      countryConfigId: input.countryConfigId,
      vehicleProfileId: vehicleProfile.id,
      sourceKind: input.sourceKind ?? "BILL_OF_ENTRY",
      assessmentStatus: "ASSESSED",
      customsOffice: input.customsOffice,
      declarationReference: input.declarationReference,
      billOfEntryNumber: input.billOfEntryNumber,
      assessmentDate: input.assessmentDate,
      currency: input.currency ?? "GHS",
      fobForeign: input.fobForeign,
      fobForeignCurrency: input.fobForeignCurrency,
      fxRate: input.fxRate,
      fobGhs: input.fobGhs,
      freightGhs: input.freightGhs,
      insuranceGhs: input.insuranceGhs,
      customsValueGhs: input.customsValueGhs,
      depreciationPercent: input.depreciationPercent,
      totalAssessedGhs: input.totalAssessedGhs,
      documentIdentityHash: identity,
      verificationStatus: input.verificationStatus ?? "PENDING",
      importerIdentifierHash: input.importerIdentifier ? hashImporterIdentifier(input.importerIdentifier) : undefined,
      notes: input.notes,
      createdById: actorId,
      lines: {
        create: mapLinesForInsert(input.lines, input.document?.documentKind),
      },
    },
    include: { lines: true },
  });

  // Fix assessmentId on nested lines — Prisma nested create handles this; remap not needed

  let documentId: string | undefined;
  if (input.document) {
    const doc = await db.dutyEvidenceDocument.create({
      data: {
        assessmentId: assessment.id,
        documentKind: input.document.documentKind,
        secureStorageKey: input.document.secureStorageKey,
        checksum: input.document.checksum,
        originalFilename: input.document.originalFilename,
        mimeType: input.document.mimeType,
        documentDate: input.document.documentDate,
        fileUrl: input.document.fileUrl,
        uploadedById: actorId,
        verificationStatus: input.verificationStatus ?? "PENDING",
      },
    });
    documentId = doc.id;
    await db.dutyAssessment.update({
      where: { id: assessment.id },
      data: { primaryDocumentId: doc.id },
    });
  }

  return {
    assessmentId: assessment.id,
    vehicleProfileId: vehicleProfile.id,
    documentId,
    lineCount: assessment.lines.length,
    totalAssessedGhs: input.totalAssessedGhs,
    duplicatePrevented: false,
  };
}

export async function attachPaymentReceipt(
  db: DbClient,
  input: PaymentReceiptIngestInput,
  actorId?: string,
): Promise<AttachReceiptResult> {
  const existing = await findAssessmentByIdentity(db, {
    billOfEntryNumber: input.billOfEntryNumber,
    customsOffice: input.customsOffice,
    declarationReference: input.declarationReference,
    assessmentDate: input.assessmentDate,
    totalPaidGhs: input.totalPaidGhs,
    importerIdentifier: input.importerIdentifier,
  });

  if (!existing) {
    throw new Error("No matching Bill of Entry assessment found for receipt.");
  }

  const receiptChecksumIdentity = buildAssessmentIdentityHash({
    billOfEntryNumber: input.billOfEntryNumber,
    customsOffice: input.customsOffice,
    totalPaidGhs: input.totalPaidGhs,
    importerIdentifier: input.importerIdentifier,
  });

  const duplicateDoc = await db.dutyEvidenceDocument.findFirst({
    where: {
      assessmentId: existing.id,
      checksum: input.document.checksum,
    },
  });
  if (duplicateDoc) {
    return {
      assessmentId: existing.id,
      matchedExisting: true,
      totalPaidGhs: Number(existing.totalPaidGhs ?? input.totalPaidGhs),
      varianceGhs: existing.varianceGhs != null ? Number(existing.varianceGhs) : null,
      unmatchedReceiptLines: [],
      duplicatePrevented: true,
    };
  }

  await db.dutyEvidenceDocument.create({
    data: {
      assessmentId: existing.id,
      documentKind: "PAYMENT_RECEIPT",
      secureStorageKey: input.document.secureStorageKey,
      checksum: input.document.checksum,
      originalFilename: input.document.originalFilename,
      mimeType: input.document.mimeType,
      documentDate: input.document.documentDate ?? input.paymentDate,
      fileUrl: input.document.fileUrl,
      uploadedById: actorId,
      verificationStatus: "PENDING",
    },
  });

  const boeLines: AssessmentLineInput[] = existing.lines.map((line) => ({
    chargeName: line.chargeName,
    amountPayable: Number(line.amountPayable),
  }));

  const receiptLines = input.lines ?? [];
  const reconciliation = reconcileAssessmentLines({
    billOfEntryLines: boeLines,
    receiptLines,
  });

  for (const key of reconciliation.matchedKeys) {
    await db.dutyAssessmentLine.updateMany({
      where: { assessmentId: existing.id, normalizedChargeKey: key },
      data: { matchedReceiptLine: true },
    });
  }

  for (const unmatched of reconciliation.unmatchedReceiptLines) {
    await db.dutyAssessmentLine.create({
      data: {
        assessmentId: existing.id,
        chargeName: unmatched.chargeName,
        normalizedChargeKey: normalizeChargeName(unmatched.chargeName),
        amountPayable: unmatched.amountPayable,
        displayOrder: existing.lines.length + 1,
        sourceDocumentKind: "PAYMENT_RECEIPT",
        unmatchedReceipt: true,
      },
    });
  }

  const varianceGhs = round2(input.totalPaidGhs - Number(existing.totalAssessedGhs));

  await db.dutyAssessment.update({
    where: { id: existing.id },
    data: {
      sourceKind: "COMBINED_ASSESSMENT",
      assessmentStatus: Math.abs(varianceGhs) <= 0.02 ? "PAID" : "PARTIALLY_PAID",
      paymentDate: input.paymentDate,
      totalPaidGhs: input.totalPaidGhs,
      varianceGhs,
      documentIdentityHash: receiptChecksumIdentity,
      notes: input.notes ? [existing.notes, input.notes].filter(Boolean).join("\n") : existing.notes,
    },
  });

  return {
    assessmentId: existing.id,
    matchedExisting: true,
    totalPaidGhs: input.totalPaidGhs,
    varianceGhs,
    unmatchedReceiptLines: reconciliation.unmatchedReceiptLines.map((l) => l.chargeName),
    duplicatePrevented: false,
  };
}

export async function evaluatePredictionOutcome(
  db: DbClient,
  params: {
    calculationId: string;
    assessmentId: string;
    predictedTotal: number;
    predictedLow?: number;
    predictedHigh?: number;
  },
) {
  const assessment = await db.dutyAssessment.findUniqueOrThrow({
    where: { id: params.assessmentId },
    select: { totalPaidGhs: true, totalAssessedGhs: true },
  });

  const actualTotal = Number(assessment.totalPaidGhs ?? assessment.totalAssessedGhs);
  const absoluteError = round2(Math.abs(params.predictedTotal - actualTotal));
  const percentageError =
    actualTotal > 0 ? round2((absoluteError / actualTotal) * 100) : 0;

  const withinRange =
    params.predictedLow != null && params.predictedHigh != null
      ? actualTotal >= params.predictedLow && actualTotal <= params.predictedHigh
      : null;

  return db.dutyPredictionOutcome.upsert({
    where: {
      calculationId_assessmentId: {
        calculationId: params.calculationId,
        assessmentId: params.assessmentId,
      },
    },
    create: {
      calculationId: params.calculationId,
      assessmentId: params.assessmentId,
      predictedTotal: params.predictedTotal,
      actualTotal,
      absoluteError,
      percentageError,
      withinRange,
    },
    update: {
      predictedTotal: params.predictedTotal,
      actualTotal,
      absoluteError,
      percentageError,
      withinRange,
      evaluatedAt: new Date(),
    },
  });
}

export async function archiveEvidenceDocument(
  db: DbClient,
  params: { documentId: string; actorId: string; reason: string },
): Promise<void> {
  const doc = await db.dutyEvidenceDocument.findUniqueOrThrow({
    where: { id: params.documentId },
    select: { archived: true, verificationStatus: true },
  });

  if (doc.verificationStatus === "VERIFIED") {
    throw new Error("Verified calibration evidence cannot be archived without privileged confirmation.");
  }

  if (doc.archived) return;

  await db.dutyEvidenceDocument.update({
    where: { id: params.documentId },
    data: {
      archived: true,
      archivedAt: new Date(),
      archivedById: params.actorId,
    },
  });
}
