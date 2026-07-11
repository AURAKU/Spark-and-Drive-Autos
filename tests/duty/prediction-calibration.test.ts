import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runCalibrationLayer } from "@/lib/duty-intelligence/calibration-engine";
import { buildEstimateFingerprint, dutyCacheGet, dutyCacheSet, estimateCacheKey } from "@/lib/duty-intelligence/cache";
import { computeCalibratedConfidence, resolveConfidenceLevel } from "@/lib/duty-intelligence/confidence";
import {
  isExactVerifiedCohort,
  loadCalibrationFixtureCohorts,
  matchCohort,
} from "@/lib/duty-intelligence/cohort-matcher";
import {
  computeEvaluationMetrics,
  ensureNoDatasetLeakage,
  evaluateCalibrationFixtures,
  evaluateHoldoutMetrics,
} from "@/lib/duty-intelligence/evaluation-metrics";
import { buildEstimateExplanation, sanitizeExplanationForCustomer } from "@/lib/duty-intelligence/explanation";
import { minimumIntakeSchema, minimumIntakeToCalculationInput } from "@/lib/duty-intelligence/intake-schema";
import { requiredQuestionIds, resolveIntakeQuestions } from "@/lib/duty-intelligence/intake-questions";
import { buildEstimateRange, buildLandedCostRange } from "@/lib/duty-intelligence/range";

describe("duty intake minimum input", () => {
  it("always requires core vehicle and purchase fields", () => {
    const questions = resolveIntakeQuestions({ input: {} as never, classificationUnresolved: false });
    const required = requiredQuestionIds(questions);
    assert.ok(required.includes("make"));
    assert.ok(required.includes("model"));
    assert.ok(required.includes("year"));
    assert.ok(required.includes("fuelType"));
    assert.ok(required.includes("fobAmount"));
    assert.ok(required.includes("fobCurrency"));
  });

  it("asks engine capacity for combustion vehicles", () => {
    const questions = resolveIntakeQuestions({
      input: { vehicle: { fuelType: "GASOLINE_PETROL" as never, manufacturer: "Toyota", model: "RAV4", year: 2022 } },
    });
    assert.ok(questions.some((q) => q.id === "engineCc" && q.required));
  });

  it("asks power output for electric vehicles when missing", () => {
    const questions = resolveIntakeQuestions({
      input: { vehicle: { fuelType: "ELECTRIC" as never, manufacturer: "BYD", model: "Sealion", year: 2025 } },
    });
    assert.ok(questions.some((q) => q.id === "powerKw"));
  });

  it("does not ask HS code unless expert mode with unresolved classification", () => {
    const normal = resolveIntakeQuestions({
      input: {} as never,
      classificationUnresolved: true,
      expertMode: false,
    });
    assert.equal(normal.some((q) => q.id === "hsCode"), false);

    const expert = resolveIntakeQuestions({
      input: {} as never,
      classificationUnresolved: true,
      expertMode: true,
    });
    assert.ok(expert.some((q) => q.id === "hsCode" && q.required));
  });

  it("converts minimum intake to full calculation input with safe defaults", () => {
    const parsed = minimumIntakeSchema.parse({
      vehicle: {
        manufacturer: "Jetour",
        model: "Dashing",
        year: 2022,
        fuelType: "GASOLINE_PETROL",
        engineCc: 1500,
      },
      purchase: { fobAmount: 13488.6, fobCurrency: "USD" },
    });
    const full = minimumIntakeToCalculationInput(parsed);
    assert.equal(full.vehicle.manufacturer, "Jetour");
    assert.equal(full.vehicle.countryOfOrigin, "CHINA");
    assert.equal(full.vehicle.vehicleCategory, "SUV");
  });
});

describe("cohort matching", () => {
  it("matches Jetour as exact verified calibration cohort", async () => {
    const cohort = await matchCohort({
      make: "Jetour",
      model: "Dashing",
      year: 2022,
      fuelType: "GASOLINE",
      hsCode: "870323",
      engineCc: 1500,
      vehicleCategory: "SUV",
    });
    assert.ok(cohort.length >= 1);
    const top = cohort[0]!;
    assert.ok(isExactVerifiedCohort(top));
    assert.equal(top.make, "Jetour");
  });

  it("never matches gasoline profile to EV", async () => {
    const cohort = await matchCohort({
      make: "BYD",
      model: "Sealion 6",
      year: 2025,
      fuelType: "ELECTRIC",
      hsCode: "870380",
    });
    for (const row of cohort) {
      assert.notEqual(row.fuelType, "GASOLINE");
    }
  });

  it("excludes holdout fixtures from training cohort queries", async () => {
    const cohort = await matchCohort({
      make: "BYD",
      model: "Sealion 6",
      year: 2025,
      fuelType: "ELECTRIC",
      hsCode: "870380",
      excludeSplits: ["HOLDOUT"],
    });
    assert.equal(cohort.some((c) => c.model === "Sealion 6"), false);
  });
});

describe("calibration engine", () => {
  it("uses exact fixture values without altering deterministic tax formulas", async () => {
    const cohort = await matchCohort({
      make: "Jetour",
      model: "Dashing",
      year: 2022,
      fuelType: "GASOLINE",
      hsCode: "870323",
    });
    const calibration = runCalibrationLayer({
      cohort,
      fobGhs: 153705.29,
      configuredCustomsValueGhs: 166085.38,
    });
    assert.equal(calibration.exactFixtureMatch, true);
    assert.equal(calibration.valuation.customsValueGhs, 166085.38);
    assert.equal(calibration.adjustments.length, 0);
  });

  it("labels insufficient data without generalized accuracy claims", () => {
    const calibration = runCalibrationLayer({ cohort: [], fobGhs: 100000 });
    assert.equal(calibration.cohortSize, 0);
    assert.ok(calibration.valuation.note.includes("No matching historical cohort"));
  });
});

describe("confidence and range", () => {
  it("uses evidence-based confidence levels without 99% claims", async () => {
    const cohort = await matchCohort({
      make: "Jetour",
      model: "Dashing",
      year: 2022,
      fuelType: "GASOLINE",
      hsCode: "870323",
    });
    const calibration = runCalibrationLayer({ cohort, fobGhs: 153705.29 });

    const level = resolveConfidenceLevel({
      verifiedProfile: true,
      hsCertainty: "EXACT",
      vehicleDataComplete: true,
      customsValueCertainty: "DECLARED",
      fxRateCertainty: "CONFIGURED",
      ruleVerificationStatus: "VERIFIED",
      cohort,
      calibration,
      similarImports: [],
    });
    assert.equal(level, "VERIFIED_PROFILE_HIGH");

    const confidence = computeCalibratedConfidence({
      verifiedProfile: true,
      hsCertainty: "EXACT",
      vehicleDataComplete: true,
      customsValueCertainty: "DECLARED",
      fxRateCertainty: "CONFIGURED",
      ruleVerificationStatus: "VERIFIED",
      cohort: [],
      calibration: runCalibrationLayer({ cohort: [], fobGhs: 100000 }),
      similarImports: [],
      evaluationMetrics: evaluateHoldoutMetrics(),
    });
    assert.ok(confidence.score <= 92);
    assert.notEqual(confidence.score, 99);
    assert.notEqual(confidence.score, 99.99);
  });

  it("downgrades confidence for limited cohort data", () => {
    const confidence = computeCalibratedConfidence({
      verifiedProfile: false,
      hsCertainty: "INFERRED",
      vehicleDataComplete: false,
      customsValueCertainty: "CONFIGURED",
      fxRateCertainty: "CONFIGURED",
      ruleVerificationStatus: "UNVERIFIED",
      cohort: [],
      calibration: runCalibrationLayer({ cohort: [], fobGhs: 100000 }),
      similarImports: [],
    });
    assert.equal(confidence.level, "ADMIN_REVIEW_REQUIRED");
  });

  it("generates low/base/high estimate range", () => {
    const range = buildEstimateRange({
      baseGhs: 61862.67,
      verifiedProfile: false,
      confidenceLevel: "MODERATE_EVIDENCE",
      calibration: runCalibrationLayer({ cohort: [{ id: "1", source: "VERIFIED_IMPORT", datasetSplit: "PRODUCTION", make: "A", model: "B", year: 2022, fuelType: "GASOLINE", hsCode: "870323", hsHeading: "8703", vehicleCategory: "SUV", engineCc: 1500, powerKw: null, ageYears: 2, assessmentDate: null, countryOfOrigin: null, customsValueGhs: 160000, fobGhs: 150000, freightGhs: 5000, insuranceGhs: 500, totalDutyGhs: 60000, totalAssessedGhs: 60000, fxRate: null, matchTier: 1, matchScore: 50, matchReasons: [] }], fobGhs: 150000 }),
    });
    assert.ok(range.lowGhs < range.expectedGhs);
    assert.ok(range.highGhs > range.expectedGhs);

    const landed = buildLandedCostRange({ customsValueGhs: 166085.38, dutyRange: range });
    assert.ok(landed.lowGhs < landed.expectedGhs);
  });
});

describe("evaluation metrics", () => {
  it("reproduces verified fixture totals with zero error", () => {
    const rows = evaluateCalibrationFixtures();
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.absoluteError, 0);
      assert.equal(row.within2Pct, true);
    }
  });

  it("does not support generalized accuracy claims with two fixtures", () => {
    const metrics = computeEvaluationMetrics(evaluateCalibrationFixtures());
    assert.equal(metrics.generalizedAccuracyClaimSupported, false);
    assert.ok(metrics.note.includes("2 verified fixture"));
  });

  it("prevents training/holdout leakage", () => {
    const rows = evaluateCalibrationFixtures();
    assert.equal(ensureNoDatasetLeakage(rows), true);
  });

  it("computes holdout metrics separately", () => {
    const holdout = evaluateHoldoutMetrics();
    assert.equal(holdout.holdoutSampleCount, 1);
    assert.equal(holdout.mae, 0);
  });
});

describe("user-safe explanation", () => {
  it("does not expose raw calibration records or other customer data", () => {
    const explanation = sanitizeExplanationForCustomer(
      buildEstimateExplanation({
        profileId: "GH-HS-870323-VERIFIED-V1",
        profileDescription: "Jetour profile",
        hsCode: "8703.23",
        confidenceLevel: "VERIFIED_PROFILE_HIGH",
        estimateRange: buildEstimateRange({ baseGhs: 61862.67, verifiedProfile: true, confidenceLevel: "VERIFIED_PROFILE_HIGH" }),
        calibration: runCalibrationLayer({ cohort: [], fobGhs: 153705.29 }),
        cohort: [],
        customsValueMethod: "CIF basis",
        fxRateUsed: 11.3952,
        fxSource: "CUSTOMS",
        effectiveRuleDate: "2024-06-15",
        assumptions: [],
      }),
    );
    assert.ok(explanation.profileUsed.includes("GH-HS-870323"));
    assert.ok(explanation.couldChangeFinalAmount.length >= 2);
    assert.equal(JSON.stringify(explanation).includes("HJRPBGGB"), false);
  });
});

describe("estimate cache fingerprint", () => {
  it("invalidates cache when material inputs change", async () => {
    const fp1 = buildEstimateFingerprint({
      make: "Jetour",
      model: "Dashing",
      year: 2022,
      fuelType: "GASOLINE",
      fobAmount: 13488.6,
      fobCurrency: "USD",
      ruleSetVersion: "v1",
    });
    const fp2 = buildEstimateFingerprint({
      make: "Jetour",
      model: "Dashing",
      year: 2022,
      fuelType: "GASOLINE",
      fobAmount: 14000,
      fobCurrency: "USD",
      ruleSetVersion: "v1",
    });
    assert.notEqual(fp1, fp2);

    const key = estimateCacheKey(fp1);
    await dutyCacheSet(key, { total: 100 }, { fingerprint: fp1 });
    const stale = await dutyCacheGet(key, fp2);
    assert.equal(stale, null);
  });
});
