import { prisma } from "@/lib/prisma";
import { getDutyAnalytics } from "@/lib/duty-intelligence/analytics";
import { evaluateCalibrationFixtures, computeEvaluationMetrics } from "@/lib/duty-intelligence/evaluation-metrics";

export type DutyAdminDashboardSnapshot = {
  totalCalculations: number;
  calculationsToday: number;
  verifiedAssessments: number;
  assessmentsAwaitingReview: number;
  avgPredictionError: number | null;
  medianPredictionError: number | null;
  within5Pct: number | null;
  within10Pct: number | null;
  highestErrorCohorts: { label: string; avgError: number; count: number }[];
  topMakesModels: { label: string; count: number }[];
  topHsCodes: { hsCode: string; count: number }[];
  fuelBreakdown: { fuelType: string; count: number }[];
  recentRuleChanges: { id: string; chargeKey: string; status: string; updatedAt: string }[];
  fxRates: { currency: string; rate: number; source: string; effectiveDate: string; stale: boolean }[];
  expiringRuleSets: { profileId: string | null; chargeKey: string; effectiveTo: string | null }[];
  evaluationNote: string;
  evaluationSampleCount: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export async function getDutyAdminDashboard(countryConfigId: string): Promise<DutyAdminDashboardSnapshot> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    analytics,
    calculationsToday,
    verifiedAssessments,
    awaitingReview,
    outcomes,
    recentRules,
    fxRows,
    expiringRules,
    calcFuelBreakdown,
    calcHsCodes,
    calcMakes,
  ] = await Promise.all([
    getDutyAnalytics(countryConfigId),
    prisma.dutyCalculation.count({
      where: { countryConfigId, createdAt: { gte: todayStart } },
    }),
    prisma.dutyAssessment.count({ where: { countryConfigId, verificationStatus: "VERIFIED" } }),
    prisma.dutyAssessment.count({
      where: { countryConfigId, verificationStatus: { in: ["PENDING", "DISPUTED"] } },
    }),
    prisma.dutyPredictionOutcome.findMany({
      orderBy: { evaluatedAt: "desc" },
      take: 200,
      select: { absoluteError: true, percentageError: true, assessmentId: true },
    }),
    prisma.dutyCalculationRule.findMany({
      where: { countryConfigId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, chargeKey: true, status: true, updatedAt: true },
    }),
    prisma.dutyExchangeRate.findMany({
      where: { countryConfigId, toCurrency: "GHS" },
      orderBy: { effectiveDate: "desc" },
      take: 10,
      select: { fromCurrency: true, rate: true, source: true, effectiveDate: true },
    }),
    prisma.dutyCalculationRule.findMany({
      where: {
        countryConfigId,
        status: "ACTIVE",
        effectiveTo: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      take: 20,
      select: { profileId: true, chargeKey: true, effectiveTo: true },
    }),
    prisma.dutyCalculation.groupBy({
      by: ["hsCode"],
      where: { countryConfigId, hsCode: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.dutyCalculation.findMany({
      where: { countryConfigId },
      select: { inputJson: true, hsCode: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.dutyCalculation.findMany({
      where: { countryConfigId },
      select: { inputJson: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const absErrors = outcomes.map((o) => Number(o.absoluteError));
  const pctErrors = outcomes.map((o) => Number(o.percentageError)).filter((n) => Number.isFinite(n));
  const avgPredictionError =
    pctErrors.length > 0 ? Math.round((pctErrors.reduce((s, n) => s + n, 0) / pctErrors.length) * 100) / 100 : analytics.avgPredictionErrorPct;
  const medianPredictionError = median(pctErrors);
  const within5Pct =
    pctErrors.length > 0
      ? Math.round((pctErrors.filter((p) => p <= 5).length / pctErrors.length) * 1000) / 10
      : null;
  const within10Pct =
    pctErrors.length > 0
      ? Math.round((pctErrors.filter((p) => p <= 10).length / pctErrors.length) * 1000) / 10
      : null;

  const fixtureMetrics = computeEvaluationMetrics(evaluateCalibrationFixtures());

  const makeMap = new Map<string, number>();
  for (const row of calcMakes) {
    const input = row.inputJson as { vehicle?: { manufacturer?: string; model?: string } } | null;
    const label = [input?.vehicle?.manufacturer, input?.vehicle?.model].filter(Boolean).join(" ");
    if (!label) continue;
    makeMap.set(label, (makeMap.get(label) ?? 0) + 1);
  }

  const staleThresholdMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return {
    totalCalculations: analytics.totalCalculations,
    calculationsToday,
    verifiedAssessments,
    assessmentsAwaitingReview: awaitingReview,
    avgPredictionError,
    medianPredictionError,
    within5Pct,
    within10Pct,
    highestErrorCohorts: [],
    topMakesModels: [...makeMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count })),
    topHsCodes: calcFuelBreakdown
      .filter((r) => r.hsCode)
      .map((r) => ({ hsCode: r.hsCode!, count: r._count.id })),
    fuelBreakdown: analytics.fuelTypeBreakdown,
    recentRuleChanges: recentRules.map((r) => ({
      id: r.id,
      chargeKey: r.chargeKey,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
    })),
    fxRates: fxRows.map((r) => ({
      currency: r.fromCurrency,
      rate: Number(r.rate),
      source: r.source,
      effectiveDate: r.effectiveDate.toISOString(),
      stale: now - r.effectiveDate.getTime() > staleThresholdMs,
    })),
    expiringRuleSets: expiringRules.map((r) => ({
      profileId: r.profileId,
      chargeKey: r.chargeKey,
      effectiveTo: r.effectiveTo?.toISOString() ?? null,
    })),
    evaluationNote: fixtureMetrics.note,
    evaluationSampleCount: fixtureMetrics.sampleCount,
  };
}
