import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";

import { loadCalibrationFixtureCohorts, type CohortRecord, type DutyDatasetSplit } from "./cohort-matcher";
import { runVersionedCalculationFromSnapshot } from "./engine-orchestrator";

export type PredictionEvaluationRow = {
  id: string;
  datasetSplit: DutyDatasetSplit;
  make: string;
  model: string;
  fuelType: string;
  hsCode: string;
  predictedTotal: number;
  actualTotal: number;
  absoluteError: number;
  percentageError: number | null;
  within2Pct: boolean;
  within5Pct: boolean;
  within10Pct: boolean;
};

export type EvaluationMetrics = {
  sampleCount: number;
  mae: number;
  medianAbsoluteError: number;
  mape: number | null;
  within2Pct: number;
  within5Pct: number;
  within10Pct: number;
  byFuelType: Record<string, { count: number; mae: number }>;
  byHsCode: Record<string, { count: number; mae: number }>;
  byVehicleClass: Record<string, { count: number; mae: number }>;
  byAssessmentMonth: Record<string, { count: number; mae: number }>;
  holdoutSampleCount: number;
  trainingSampleCount: number;
  generalizedAccuracyClaimSupported: boolean;
  note: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function evaluateFixture(
  fixture: typeof JETOUR_DASHING_CALIBRATION,
  cohort: CohortRecord,
): PredictionEvaluationRow | null {
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

  if (!outcome.ok) return null;

  const predictedTotal = outcome.engineResult.totalDutyPayableGhs;
  const actualTotal = fixture.totalAssessedGhs!;
  const absoluteError = round2(Math.abs(predictedTotal - actualTotal));
  const percentageError = actualTotal > 0 ? round2((absoluteError / actualTotal) * 100) : null;

  return {
    id: cohort.id,
    datasetSplit: cohort.datasetSplit,
    make: fixture.vehicle.make ?? "",
    model: fixture.vehicle.model ?? "",
    fuelType: fixture.vehicle.fuelType,
    hsCode: fixture.vehicle.hsCode ?? "",
    predictedTotal,
    actualTotal,
    absoluteError,
    percentageError,
    within2Pct: percentageError != null && percentageError <= 2,
    within5Pct: percentageError != null && percentageError <= 5,
    within10Pct: percentageError != null && percentageError <= 10,
  };
}

export function evaluateCalibrationFixtures(): PredictionEvaluationRow[] {
  const cohorts = loadCalibrationFixtureCohorts();
  const rows: PredictionEvaluationRow[] = [];

  const jetour = cohorts.find((c) => c.id === "fixture-jetour-dashing");
  const byd = cohorts.find((c) => c.id === "fixture-byd-sealion6");

  if (jetour) {
    const row = evaluateFixture(JETOUR_DASHING_CALIBRATION, jetour);
    if (row) rows.push(row);
  }
  if (byd) {
    const row = evaluateFixture(BYD_SEALION6_CALIBRATION, byd);
    if (row) rows.push(row);
  }

  return rows;
}

export function computeEvaluationMetrics(rows: PredictionEvaluationRow[]): EvaluationMetrics {
  if (rows.length === 0) {
    return {
      sampleCount: 0,
      mae: 0,
      medianAbsoluteError: 0,
      mape: null,
      within2Pct: 0,
      within5Pct: 0,
      within10Pct: 0,
      byFuelType: {},
      byHsCode: {},
      byVehicleClass: {},
      byAssessmentMonth: {},
      holdoutSampleCount: 0,
      trainingSampleCount: 0,
      generalizedAccuracyClaimSupported: false,
      note: "No evaluation rows available.",
    };
  }

  const absErrors = rows.map((r) => r.absoluteError);
  const mae = round2(absErrors.reduce((s, v) => s + v, 0) / absErrors.length);
  const sorted = [...absErrors].sort((a, b) => a - b);
  const medianAbsoluteError = round2(sorted[Math.floor(sorted.length / 2)]!);

  const mapeValues = rows.filter((r) => r.percentageError != null && r.actualTotal > 0).map((r) => r.percentageError!);
  const mape = mapeValues.length > 0 ? round2(mapeValues.reduce((s, v) => s + v, 0) / mapeValues.length) : null;

  const holdoutRows = rows.filter((r) => r.datasetSplit === "HOLDOUT");
  const trainingRows = rows.filter((r) => r.datasetSplit === "TRAINING");

  const byFuelType: EvaluationMetrics["byFuelType"] = {};
  const byHsCode: EvaluationMetrics["byHsCode"] = {};
  const byVehicleClass: EvaluationMetrics["byVehicleClass"] = {};

  for (const row of rows) {
    byFuelType[row.fuelType] ??= { count: 0, mae: 0 };
    byFuelType[row.fuelType]!.count += 1;
    byFuelType[row.fuelType]!.mae = round2(byFuelType[row.fuelType]!.mae + row.absoluteError);

    byHsCode[row.hsCode] ??= { count: 0, mae: 0 };
    byHsCode[row.hsCode]!.count += 1;
    byHsCode[row.hsCode]!.mae = round2(byHsCode[row.hsCode]!.mae + row.absoluteError);

    const vehicleClass = row.fuelType === "ELECTRIC" ? "EV" : "ICE";
    byVehicleClass[vehicleClass] ??= { count: 0, mae: 0 };
    byVehicleClass[vehicleClass]!.count += 1;
    byVehicleClass[vehicleClass]!.mae = round2(byVehicleClass[vehicleClass]!.mae + row.absoluteError);
  }

  for (const key of Object.keys(byFuelType)) {
    byFuelType[key]!.mae = round2(byFuelType[key]!.mae / byFuelType[key]!.count);
  }
  for (const key of Object.keys(byHsCode)) {
    byHsCode[key]!.mae = round2(byHsCode[key]!.mae / byHsCode[key]!.count);
  }
  for (const key of Object.keys(byVehicleClass)) {
    byVehicleClass[key]!.mae = round2(byVehicleClass[key]!.mae / byVehicleClass[key]!.count);
  }

  const generalizedAccuracyClaimSupported = rows.length >= 10 && holdoutRows.length >= 3;

  return {
    sampleCount: rows.length,
    mae,
    medianAbsoluteError,
    mape,
    within2Pct: round2((rows.filter((r) => r.within2Pct).length / rows.length) * 100),
    within5Pct: round2((rows.filter((r) => r.within5Pct).length / rows.length) * 100),
    within10Pct: round2((rows.filter((r) => r.within10Pct).length / rows.length) * 100),
    byFuelType,
    byHsCode,
    byVehicleClass,
    byAssessmentMonth: {},
    holdoutSampleCount: holdoutRows.length,
    trainingSampleCount: trainingRows.length,
    generalizedAccuracyClaimSupported,
    note: generalizedAccuracyClaimSupported
      ? "Holdout metrics available for supported accuracy reporting."
      : `Only ${rows.length} verified fixture(s) — use as exact regression cases; do not claim generalized model accuracy.`,
  };
}

export function evaluateHoldoutMetrics(): EvaluationMetrics {
  const rows = evaluateCalibrationFixtures();
  const holdoutOnly = rows.filter((r) => r.datasetSplit === "HOLDOUT");
  return computeEvaluationMetrics(holdoutOnly.length > 0 ? holdoutOnly : rows);
}

export function evaluateTrainingMetrics(): EvaluationMetrics {
  const rows = evaluateCalibrationFixtures().filter((r) => r.datasetSplit === "TRAINING");
  return computeEvaluationMetrics(rows);
}

export function ensureNoDatasetLeakage(rows: PredictionEvaluationRow[]): boolean {
  const holdoutIds = new Set(rows.filter((r) => r.datasetSplit === "HOLDOUT").map((r) => r.id));
  const trainingIds = new Set(rows.filter((r) => r.datasetSplit === "TRAINING").map((r) => r.id));
  for (const id of holdoutIds) {
    if (trainingIds.has(id)) return false;
  }
  return true;
}
