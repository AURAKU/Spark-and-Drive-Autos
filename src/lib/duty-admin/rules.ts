import {
  BYD_SEALION6_CALIBRATION,
  CALIBRATION_FIXTURES,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import { runVersionedCalculationFromSnapshot } from "@/lib/duty-intelligence/engine-orchestrator";
import { prisma } from "@/lib/prisma";

export type RuleRegressionResult = {
  fixtureId: string;
  make: string;
  model: string;
  ok: boolean;
  predictedTotal: number | null;
  actualTotal: number;
  errorGhs: number | null;
  errorPct: number | null;
  message?: string;
};

export type RulePublishPreview = {
  regressionResults: RuleRegressionResult[];
  allPassed: boolean;
  changedProfiles: string[];
};

function runFixtureRegression(fixture: typeof JETOUR_DASHING_CALIBRATION, id: string): RuleRegressionResult {
  const outcome = runVersionedCalculationFromSnapshot({
    hsCode: fixture.vehicle.hsCode!,
    fuelType: fixture.vehicle.fuelType,
    manufactureYear: fixture.vehicle.manufactureYear,
    engineCc: fixture.vehicle.engineCc,
    powerKw: fixture.vehicle.powerKw,
    vehicleCategory: fixture.vehicle.vehicleCategory,
    assessmentDate: fixture.assessmentDate!,
    fobGhs: fixture.fobGhs!,
    freightGhs: fixture.freightGhs!,
    insuranceGhs: fixture.insuranceGhs!,
    customsValueGhs: fixture.customsValueGhs!,
    documentedTotalGhs: fixture.totalAssessedGhs!,
  });

  const actualTotal = fixture.totalAssessedGhs!;
  if (!outcome.ok) {
    return {
      fixtureId: id,
      make: fixture.vehicle.make ?? "",
      model: fixture.vehicle.model ?? "",
      ok: false,
      predictedTotal: null,
      actualTotal,
      errorGhs: null,
      errorPct: null,
      message: outcome.error.message,
    };
  }

  const predictedTotal = outcome.engineResult.totalDutyPayableGhs;
  const errorGhs = Math.abs(predictedTotal - actualTotal);
  const errorPct = actualTotal > 0 ? Math.round((errorGhs / actualTotal) * 10000) / 100 : 0;

  return {
    fixtureId: id,
    make: fixture.vehicle.make ?? "",
    model: fixture.vehicle.model ?? "",
    ok: errorGhs <= 0.02,
    predictedTotal,
    actualTotal,
    errorGhs,
    errorPct,
  };
}

export function runVerifiedFixtureRegression(): RulePublishPreview {
  const results = [
    runFixtureRegression(JETOUR_DASHING_CALIBRATION, "jetour-dashing"),
    runFixtureRegression(BYD_SEALION6_CALIBRATION, "byd-sealion6"),
    ...CALIBRATION_FIXTURES.map((f, i) => runFixtureRegression(f, `fixture-${i}`)),
  ];

  const unique = new Map<string, RuleRegressionResult>();
  for (const r of results) unique.set(r.fixtureId, r);

  const regressionResults = [...unique.values()];
  return {
    regressionResults,
    allPassed: regressionResults.every((r) => r.ok),
    changedProfiles: [],
  };
}

export async function listCalculationRules(params: {
  countryConfigId: string;
  status?: string;
  profileId?: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    countryConfigId: params.countryConfigId,
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.profileId ? { profileId: params.profileId } : {}),
  };

  const [items, totalItems] = await Promise.all([
    prisma.dutyCalculationRule.findMany({
      where,
      orderBy: [{ profileId: "asc" }, { dependencyOrder: "asc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { source: true, profile: { select: { make: true, model: true, hsCode: true } } },
    }),
    prisma.dutyCalculationRule.count({ where }),
  ]);

  return {
    items,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
  };
}

export async function publishDraftRules(params: {
  countryConfigId: string;
  ruleIds: string[];
  actorId: string;
  confirmRegression: boolean;
}): Promise<{ ok: boolean; error?: string; preview?: RulePublishPreview }> {
  if (!params.confirmRegression) {
    return { ok: false, error: "Explicit regression confirmation required before publish." };
  }

  const preview = runVerifiedFixtureRegression();
  if (!preview.allPassed) {
    return { ok: false, error: "Regression failed — fix rules before publishing.", preview };
  }

  const rules = await prisma.dutyCalculationRule.findMany({
    where: { id: { in: params.ruleIds }, countryConfigId: params.countryConfigId, status: "DRAFT" },
  });

  if (rules.length === 0) {
    return { ok: false, error: "No draft rules found to publish." };
  }

  await prisma.$transaction(async (tx) => {
    for (const rule of rules) {
      await tx.dutyCalculationRule.updateMany({
        where: {
          countryConfigId: params.countryConfigId,
          chargeKey: rule.chargeKey,
          profileId: rule.profileId,
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED", effectiveTo: new Date() },
      });
      await tx.dutyCalculationRule.update({
        where: { id: rule.id },
        data: { status: "ACTIVE", effectiveFrom: new Date() },
      });
    }
  });

  return { ok: true, preview };
}

export async function retireRule(ruleId: string): Promise<void> {
  await prisma.dutyCalculationRule.update({
    where: { id: ruleId },
    data: { status: "ARCHIVED", effectiveTo: new Date() },
  });
}

export async function cloneRuleSet(params: {
  countryConfigId: string;
  profileId: string | null;
  actorId: string;
}): Promise<number> {
  const sourceRules = await prisma.dutyCalculationRule.findMany({
    where: {
      countryConfigId: params.countryConfigId,
      profileId: params.profileId,
      status: "ACTIVE",
    },
  });

  if (sourceRules.length === 0) return 0;

  await prisma.dutyCalculationRule.createMany({
    data: sourceRules.map((r) => ({
      countryConfigId: r.countryConfigId,
      profileId: r.profileId,
      chargeKey: r.chargeKey,
      chargeName: r.chargeName,
      rateType: r.rateType,
      rateValue: r.rateValue,
      flatAmount: r.flatAmount,
      taxableBaseExpression: r.taxableBaseExpression,
      roundingMode: r.roundingMode,
      decimalPlaces: r.decimalPlaces,
      dependencyOrder: r.dependencyOrder,
      effectiveFrom: new Date(),
      sourceId: r.sourceId,
      status: "DRAFT" as const,
      createdById: params.actorId,
    })),
  });

  return sourceRules.length;
}
