import {
  BYD_SEALION6_CALIBRATION,
  CALIBRATION_FIXTURES,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import { normalizeHsCode } from "@/lib/duty-assessment/identity";
import { prisma } from "@/lib/prisma";

export type DutyDatasetSplit = "TRAINING" | "VALIDATION" | "HOLDOUT" | "PRODUCTION";

export type CohortRecord = {
  id: string;
  source: "CALIBRATION_FIXTURE" | "VERIFIED_IMPORT" | "ASSESSMENT";
  datasetSplit: DutyDatasetSplit;
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string | null;
  hsCode: string | null;
  hsHeading: string | null;
  vehicleCategory: string | null;
  engineCc: number | null;
  powerKw: number | null;
  ageYears: number | null;
  assessmentDate: string | null;
  countryOfOrigin: string | null;
  customsValueGhs: number | null;
  fobGhs: number | null;
  freightGhs: number | null;
  insuranceGhs: number | null;
  totalDutyGhs: number | null;
  totalAssessedGhs: number | null;
  fxRate: number | null;
  matchTier: number;
  matchScore: number;
  matchReasons: string[];
};

export type CohortMatchInput = {
  make?: string;
  model?: string;
  year?: number;
  fuelType: string;
  hsCode?: string;
  vehicleCategory?: string;
  engineCc?: number;
  powerKw?: number;
  assessmentDate?: Date;
  countryOfOrigin?: string;
  excludeIds?: string[];
  excludeSplits?: DutyDatasetSplit[];
  limit?: number;
};

const FIXTURE_SPLITS: Record<string, DutyDatasetSplit> = {
  "CAL-JETOUR-DASHING-2022": "TRAINING",
  "CAL-BYD-SEALION6-2025": "HOLDOUT",
};

function hsHeading(hsCode: string | null | undefined): string | null {
  if (!hsCode) return null;
  const digits = hsCode.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 4) : digits;
}

function engineBand(cc: number | null): string | null {
  if (cc == null) return null;
  if (cc <= 1000) return "0-1000";
  if (cc <= 1500) return "1001-1500";
  if (cc <= 2000) return "1501-2000";
  if (cc <= 3000) return "2001-3000";
  return "3000+";
}

function powerBand(kw: number | null): string | null {
  if (kw == null) return null;
  if (kw <= 100) return "0-100";
  if (kw <= 170) return "101-170";
  return "170+";
}

function ageYears(year: number | null, assessmentDate?: Date): number | null {
  if (year == null) return null;
  const refYear = assessmentDate?.getFullYear() ?? new Date().getFullYear();
  return Math.max(0, refYear - year);
}

function fixtureToCohort(fixture: typeof JETOUR_DASHING_CALIBRATION, id: string): CohortRecord {
  const hs = fixture.vehicle.hsCode ?? null;
  return {
    id,
    source: "CALIBRATION_FIXTURE",
    datasetSplit: FIXTURE_SPLITS[fixture.billOfEntryNumber ?? ""] ?? "TRAINING",
    make: fixture.vehicle.make ?? null,
    model: fixture.vehicle.model ?? null,
    year: fixture.vehicle.manufactureYear ?? null,
    fuelType: fixture.vehicle.fuelType ?? null,
    hsCode: hs,
    hsHeading: hsHeading(hs),
    vehicleCategory: fixture.vehicle.vehicleCategory ?? null,
    engineCc: fixture.vehicle.engineCc ?? null,
    powerKw: fixture.vehicle.powerKw ?? null,
    ageYears: ageYears(fixture.vehicle.manufactureYear ?? null, fixture.assessmentDate ?? undefined),
    assessmentDate: fixture.assessmentDate?.toISOString() ?? null,
    countryOfOrigin: fixture.vehicle.countryOfOrigin ?? null,
    customsValueGhs: fixture.customsValueGhs ?? null,
    fobGhs: fixture.fobGhs ?? null,
    freightGhs: fixture.freightGhs ?? null,
    insuranceGhs: fixture.insuranceGhs ?? null,
    totalDutyGhs: fixture.totalAssessedGhs ?? null,
    totalAssessedGhs: fixture.totalAssessedGhs ?? null,
    fxRate: fixture.fxRate ?? null,
    matchTier: 0,
    matchScore: 0,
    matchReasons: [],
  };
}

function normalizeFuel(fuel: string | null | undefined): string | null {
  if (!fuel) return null;
  if (fuel === "GASOLINE_PETROL") return "GASOLINE";
  if (fuel === "GASOLINE_DIESEL") return "DIESEL";
  return fuel;
}

function scoreCohort(input: CohortMatchInput, row: Omit<CohortRecord, "matchTier" | "matchScore" | "matchReasons">): CohortRecord {
  const reasons: string[] = [];
  let tier = 99;
  let score = 0;

  const inputFuel = normalizeFuel(input.fuelType);
  const rowFuel = normalizeFuel(row.fuelType);
  if (inputFuel && rowFuel && inputFuel !== rowFuel) {
    return { ...row, matchTier: 999, matchScore: 0, matchReasons: ["fuel_type_mismatch"] };
  }

  const inputHs = input.hsCode ? normalizeHsCode(input.hsCode).replace(/\D/g, "") : null;
  const rowHs = row.hsCode ? normalizeHsCode(row.hsCode).replace(/\D/g, "") : null;

  if (inputHs && rowHs && inputHs === rowHs) {
    tier = Math.min(tier, 1);
    score += 40;
    reasons.push("exact_hs_code");
  } else if (inputHs && row.hsHeading && inputHs.slice(0, 4) === row.hsHeading) {
    tier = Math.min(tier, 2);
    score += 25;
    reasons.push("hs_heading_match");
  }

  if (input.make && row.make && input.make.toLowerCase() === row.make.toLowerCase()) {
    score += 20;
    reasons.push("exact_make");
    if (input.model && row.model && input.model.toLowerCase() === row.model.toLowerCase()) {
      tier = Math.min(tier, 1);
      score += 25;
      reasons.push("exact_make_model");
    } else if (input.model && row.model && row.model.toLowerCase().includes(input.model.toLowerCase().slice(0, 3))) {
      tier = Math.min(tier, 3);
      score += 10;
      reasons.push("partial_model");
    }
  }

  if (input.vehicleCategory && row.vehicleCategory && input.vehicleCategory === row.vehicleCategory) {
    score += 8;
    reasons.push("vehicle_category");
  }

  if (input.engineCc != null && row.engineCc != null) {
    if (engineBand(input.engineCc) === engineBand(row.engineCc)) {
      score += 10;
      reasons.push("engine_band");
    }
  }

  if (input.powerKw != null && row.powerKw != null) {
    if (powerBand(input.powerKw) === powerBand(row.powerKw)) {
      score += 10;
      reasons.push("power_band");
    }
  }

  if (input.year != null && row.year != null) {
    const diff = Math.abs(input.year - row.year);
    if (diff === 0) {
      score += 12;
      reasons.push("exact_year");
    } else if (diff <= 1) {
      score += 8;
      reasons.push("near_year");
    }
  }

  if (input.countryOfOrigin && row.countryOfOrigin && input.countryOfOrigin === row.countryOfOrigin) {
    score += 4;
    reasons.push("origin_country");
  }

  return { ...row, matchTier: tier, matchScore: score, matchReasons: reasons };
}

export function loadCalibrationFixtureCohorts(): CohortRecord[] {
  return [
    fixtureToCohort(JETOUR_DASHING_CALIBRATION, "fixture-jetour-dashing"),
    fixtureToCohort(BYD_SEALION6_CALIBRATION, "fixture-byd-sealion6"),
    ...CALIBRATION_FIXTURES.map((f, i) => fixtureToCohort(f, `fixture-${i}`)),
  ];
}

export async function loadVerifiedImportCohorts(countryConfigId: string): Promise<CohortRecord[]> {
  const rows = await prisma.dutyVerifiedImport.findMany({
    where: { countryConfigId, status: "VERIFIED" },
    orderBy: { verifiedAt: "desc" },
    take: 500,
    select: {
      id: true,
      manufacturer: true,
      model: true,
      year: true,
      fuelType: true,
      hsCode: true,
      vehicleCategory: true,
      engineCc: true,
      countryOfOrigin: true,
      customsValueGhs: true,
      fobAmount: true,
      freightGhs: true,
      insuranceGhs: true,
      exchangeRate: true,
      totalDutyGhs: true,
      totalLandedCostGhs: true,
      verifiedAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    source: "VERIFIED_IMPORT" as const,
    datasetSplit: "PRODUCTION" as DutyDatasetSplit,
    make: row.manufacturer,
    model: row.model,
    year: row.year,
    fuelType: row.fuelType,
    hsCode: row.hsCode,
    hsHeading: hsHeading(row.hsCode),
    vehicleCategory: row.vehicleCategory,
    engineCc: row.engineCc,
    powerKw: null,
    ageYears: ageYears(row.year, row.verifiedAt ?? undefined),
    assessmentDate: row.verifiedAt?.toISOString() ?? null,
    countryOfOrigin: row.countryOfOrigin,
    customsValueGhs: row.customsValueGhs != null ? Number(row.customsValueGhs) : null,
    fobGhs: row.fobAmount != null ? Number(row.fobAmount) : null,
    freightGhs: row.freightGhs != null ? Number(row.freightGhs) : null,
    insuranceGhs: row.insuranceGhs != null ? Number(row.insuranceGhs) : null,
    totalDutyGhs: row.totalDutyGhs != null ? Number(row.totalDutyGhs) : null,
    totalAssessedGhs: row.totalDutyGhs != null ? Number(row.totalDutyGhs) : null,
    fxRate: row.exchangeRate != null ? Number(row.exchangeRate) : null,
    matchTier: 0,
    matchScore: 0,
    matchReasons: [],
  }));
}

export async function matchCohort(input: CohortMatchInput & { countryConfigId?: string }): Promise<CohortRecord[]> {
  const fixtures = loadCalibrationFixtureCohorts();
  const dbRows = input.countryConfigId ? await loadVerifiedImportCohorts(input.countryConfigId) : [];
  const unique = new Map<string, CohortRecord>();
  for (const row of [...fixtures, ...dbRows]) {
    unique.set(row.id, row);
  }

  const scored = [...unique.values()]
    .filter((row) => !input.excludeIds?.includes(row.id))
    .filter((row) => !input.excludeSplits?.includes(row.datasetSplit))
    .map((row) => scoreCohort(input, row))
    .filter((row) => row.matchScore > 0 && row.matchTier < 999)
    .sort((a, b) => a.matchTier - b.matchTier || b.matchScore - a.matchScore);

  return scored.slice(0, input.limit ?? 20);
}

export function isExactVerifiedCohort(match: CohortRecord): boolean {
  return (
    match.source === "CALIBRATION_FIXTURE" &&
    (match.matchTier === 1 || match.matchReasons.includes("exact_make_model"))
  );
}
