import { computeEvaluationMetrics, evaluateCalibrationFixtures } from "@/lib/duty-intelligence/evaluation-metrics";
import { loadCalibrationFixtureCohorts, matchCohort } from "@/lib/duty-intelligence/cohort-matcher";
import { prisma } from "@/lib/prisma";

export type CalibrationAnalyticsSnapshot = {
  evaluation: ReturnType<typeof computeEvaluationMetrics>;
  cohortFixtures: number;
  verifiedImportCount: number;
  exactMatchCount: number;
  fallbackMatchCount: number;
  byHsCode: Record<string, { count: number; mae: number }>;
  byFuelType: Record<string, { count: number; mae: number }>;
  insufficientDataWarnings: string[];
  suspectedOutliers: { id: string; label: string; errorPct: number }[];
  staleCohorts: string[];
};

export async function getCalibrationAnalytics(countryConfigId: string): Promise<CalibrationAnalyticsSnapshot> {
  const rows = evaluateCalibrationFixtures();
  const evaluation = computeEvaluationMetrics(rows);

  const verifiedImportCount = await prisma.dutyVerifiedImport.count({
    where: { countryConfigId, status: "VERIFIED" },
  });

  const fixtures = loadCalibrationFixtureCohorts();
  const jetourCohort = await matchCohort({
    countryConfigId,
    make: "Jetour",
    model: "Dashing",
    year: 2022,
    fuelType: "GASOLINE",
    hsCode: "870323",
  });

  const insufficientDataWarnings: string[] = [];
  if (evaluation.sampleCount < 10) {
    insufficientDataWarnings.push(
      `Only ${evaluation.sampleCount} verified fixture(s) — do not publish global accuracy claims.`,
    );
  }
  if (verifiedImportCount < 3) {
    insufficientDataWarnings.push(`Only ${verifiedImportCount} verified import(s) in database.`);
  }

  const outcomes = await prisma.dutyPredictionOutcome.findMany({
    orderBy: { percentageError: "desc" },
    take: 10,
    include: {
      assessment: { include: { vehicleProfile: { select: { make: true, model: true } } } },
    },
  });

  return {
    evaluation,
    cohortFixtures: fixtures.length,
    verifiedImportCount,
    exactMatchCount: jetourCohort.filter((c) => c.matchTier === 1).length,
    fallbackMatchCount: jetourCohort.filter((c) => c.matchTier > 1).length,
    byHsCode: evaluation.byHsCode,
    byFuelType: evaluation.byFuelType,
    insufficientDataWarnings,
    suspectedOutliers: outcomes
      .filter((o) => Number(o.percentageError) > 10)
      .map((o) => ({
        id: o.id,
        label: `${o.assessment.vehicleProfile.make} ${o.assessment.vehicleProfile.model}`,
        errorPct: Number(o.percentageError),
      })),
    staleCohorts: [],
  };
}
