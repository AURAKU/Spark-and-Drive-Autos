import { prisma } from "@/lib/prisma";

import type { VersionedCalculationSuccess } from "./engine-orchestrator";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "./formula-version";

export async function persistVersionedCalculation(params: {
  countryConfigId: string;
  outcome: VersionedCalculationSuccess;
  inputJson: object;
  createdById?: string;
  carId?: string;
  referenceNumber?: string;
}): Promise<{ id: string; referenceNumber: string }> {
  const { customAlphabet } = await import("nanoid");
  const nanoid = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
  const referenceNumber = params.referenceNumber ?? `DI-${nanoid()}`;

  const { engineResult, estimateRange, confidence } = params.outcome;

  const row = await prisma.dutyCalculation.create({
    data: {
      countryConfigId: params.countryConfigId,
      referenceNumber,
      status: "SAVED",
      carId: params.carId,
      createdById: params.createdById,
      inputJson: params.inputJson,
      resultJson: {
        engine: engineResult,
        estimateRange,
        confidence,
        profileId: params.outcome.profileId,
        hsCode: params.outcome.hsCode,
      } as object,
      formulaVersion: DUTY_INTELLIGENCE_FORMULA_VERSION,
      ruleSetVersion: engineResult.ruleSetVersion,
      classificationProfileId: params.outcome.profileId,
      formulaSnapshotJson: engineResult.formulaSnapshot as object,
      lineSnapshotsJson: engineResult.lineSnapshots as object,
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceLevel: confidence.label,
      predictedTotalGhs: engineResult.totalDutyPayableGhs,
      predictedLowGhs: estimateRange.lowGhs,
      predictedHighGhs: estimateRange.highGhs,
      totalLandedCostGhs: engineResult.valueContext.customsValueGhs + engineResult.totalDutyPayableGhs,
      totalGraTaxesGhs: engineResult.totalDutyPayableGhs,
      totalPortChargesGhs: 0,
      cifGhs: engineResult.valueContext.cifGhs,
      customsValueGhs: engineResult.valueContext.customsValueGhs,
      hsCode: params.outcome.hsCodeNormalized,
    },
  });

  return { id: row.id, referenceNumber: row.referenceNumber };
}
