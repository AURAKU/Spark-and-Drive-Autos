import { prisma } from "@/lib/prisma";
import { stripCalibrationTags } from "@/lib/duty-admin/calibration-eligibility";
import { toMaskedAssessmentSummary } from "@/lib/duty-assessment/masking";
import { runVersionedCalculationFromSnapshot } from "@/lib/duty-intelligence/engine-orchestrator";
import { evaluatePredictionOutcome } from "@/lib/duty-assessment/ingestion";

export async function listAssessments(params: {
  countryConfigId?: string;
  verificationStatus?: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(params.countryConfigId ? { countryConfigId: params.countryConfigId } : {}),
    ...(params.verificationStatus ? { verificationStatus: params.verificationStatus as never } : {}),
    archivedAt: null,
  };

  const [rows, totalItems] = await Promise.all([
    prisma.dutyAssessment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        vehicleProfile: { select: { make: true, model: true, hsCode: true, fuelType: true } },
      },
    }),
    prisma.dutyAssessment.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      ...toMaskedAssessmentSummary(r),
      make: r.vehicleProfile.make,
      model: r.vehicleProfile.model,
      hsCode: r.vehicleProfile.hsCode,
      fuelType: r.vehicleProfile.fuelType,
    })),
    page: params.page,
    pageSize: params.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
  };
}

export async function getAssessmentDetail(assessmentId: string) {
  const assessment = await prisma.dutyAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      vehicleProfile: true,
      lines: { orderBy: { displayOrder: "asc" } },
      documents: { where: { archived: false } },
      predictionOutcomes: { orderBy: { evaluatedAt: "desc" }, take: 5 },
      verifiedBy: { select: { email: true, name: true } },
    },
  });
  if (!assessment) return null;

  let engineReproduction: {
    ok: boolean;
    totalDutyGhs?: number;
    varianceGhs?: number;
    message?: string;
  } | null = null;

  if (assessment.fobGhs != null && assessment.customsValueGhs != null && assessment.totalAssessedGhs != null) {
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: assessment.vehicleProfile.hsCode,
      fuelType: assessment.vehicleProfile.fuelType,
      manufactureYear: assessment.vehicleProfile.manufactureYear,
      engineCc: assessment.vehicleProfile.engineCc ?? undefined,
      powerKw: assessment.vehicleProfile.powerKw != null ? Number(assessment.vehicleProfile.powerKw) : undefined,
      vehicleCategory: assessment.vehicleProfile.vehicleCategory ?? undefined,
      assessmentDate: assessment.assessmentDate ?? new Date(),
      fobGhs: Number(assessment.fobGhs),
      freightGhs: Number(assessment.freightGhs ?? 0),
      insuranceGhs: Number(assessment.insuranceGhs ?? 0),
      customsValueGhs: Number(assessment.customsValueGhs),
      documentedTotalGhs: Number(assessment.totalAssessedGhs),
    });

    if (outcome.ok) {
      const predicted = outcome.engineResult.totalDutyPayableGhs;
      const actual = Number(assessment.totalAssessedGhs);
      engineReproduction = {
        ok: true,
        totalDutyGhs: predicted,
        varianceGhs: Math.round((predicted - actual) * 100) / 100,
      };
    } else {
      engineReproduction = { ok: false, message: outcome.error.message };
    }
  }

  return { assessment, engineReproduction };
}

export async function verifyAssessment(params: {
  assessmentId: string;
  actorId: string;
  notes?: string;
  calibrationEligible?: boolean;
}): Promise<void> {
  await prisma.dutyAssessment.update({
    where: { id: params.assessmentId },
    data: {
      verificationStatus: "VERIFIED",
      verifiedById: params.actorId,
      verifiedAt: new Date(),
      assessmentStatus: "VERIFIED",
      notes: params.calibrationEligible
        ? [params.notes, "[calibration:eligible]"].filter(Boolean).join("\n")
        : params.notes,
    },
  });
}

export async function rejectAssessment(params: {
  assessmentId: string;
  actorId: string;
  reason: string;
}): Promise<void> {
  await prisma.dutyAssessment.update({
    where: { id: params.assessmentId },
    data: {
      verificationStatus: "DISPUTED",
      notes: params.reason,
    },
  });
}

export async function requestAssessmentCorrection(params: {
  assessmentId: string;
  actorId: string;
  reason: string;
}): Promise<void> {
  const existing = await prisma.dutyAssessment.findUniqueOrThrow({
    where: { id: params.assessmentId },
    select: { notes: true },
  });
  await prisma.dutyAssessment.update({
    where: { id: params.assessmentId },
    data: {
      verificationStatus: "PENDING",
      assessmentStatus: "ASSESSED",
      notes: [existing.notes, `[correction-requested] ${params.reason}`].filter(Boolean).join("\n"),
    },
  });
}

export async function setCalibrationEligibility(params: {
  assessmentId: string;
  eligible: boolean;
  actorId: string;
}): Promise<void> {
  const existing = await prisma.dutyAssessment.findUniqueOrThrow({
    where: { id: params.assessmentId },
    select: { notes: true },
  });
  const stripped = stripCalibrationTags(existing.notes);
  const tag = params.eligible ? "[calibration:eligible]" : "[calibration:ineligible]";
  await prisma.dutyAssessment.update({
    where: { id: params.assessmentId },
    data: { notes: [stripped, tag].filter(Boolean).join("\n") },
  });
}

export { isCalibrationEligible } from "@/lib/duty-admin/calibration-eligibility";

export async function compareAssessmentToCalculation(params: {
  assessmentId: string;
  calculationId: string;
}): Promise<void> {
  const [assessment, calculation] = await Promise.all([
    prisma.dutyAssessment.findUniqueOrThrow({ where: { id: params.assessmentId } }),
    prisma.dutyCalculation.findUniqueOrThrow({ where: { id: params.calculationId } }),
  ]);

  await evaluatePredictionOutcome(prisma, {
    assessmentId: params.assessmentId,
    calculationId: params.calculationId,
    predictedTotal: Number(calculation.predictedTotalGhs ?? 0),
    predictedLow: calculation.predictedLowGhs != null ? Number(calculation.predictedLowGhs) : undefined,
    predictedHigh: calculation.predictedHighGhs != null ? Number(calculation.predictedHighGhs) : undefined,
  });
}

export async function listCalculations(params: {
  countryConfigId: string;
  page: number;
  pageSize: number;
}) {
  const where = { countryConfigId: params.countryConfigId };

  const [items, totalItems] = await Promise.all([
    prisma.dutyCalculation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        createdAt: true,
        hsCode: true,
        predictedTotalGhs: true,
        predictedLowGhs: true,
        predictedHighGhs: true,
        confidenceLevel: true,
        formulaVersion: true,
        ruleSetVersion: true,
        classificationProfileId: true,
      },
    }),
    prisma.dutyCalculation.count({ where }),
  ]);

  return { items, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)) };
}

export async function getCalculationDetail(calculationId: string) {
  return prisma.dutyCalculation.findUnique({
    where: { id: calculationId },
    include: {
      predictionOutcomes: { include: { assessment: { select: { id: true, billOfEntryNumber: true, totalAssessedGhs: true } } } },
      createdBy: { select: { email: true, name: true } },
    },
  });
}
