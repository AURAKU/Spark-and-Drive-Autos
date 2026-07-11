import {
  applyValueOverrides,
  buildChargeOverrideMap,
  buildOverrideAuditSnapshot,
  mergeLegacyChargeOverrides,
  type AdminOverrideRecord,
} from "./audit";
import { classifyVehicleInput } from "./classification";
import { runCalculationEngine } from "./calculation-engine";
import { resolveCustomsValue } from "./customs-value";
import { engineError, isEngineError, type DutyEngineError } from "./errors";
import { requireHsProfile } from "./hs-profile-resolver";
import { buildEstimateRange } from "./range";
import { resolveRuleSet } from "./rule-set-resolver";
import { validateEngineRequest, type EngineCalculationRequest } from "./validation";
import type { ConfidenceResult } from "./types";

function normalizeOverrideRecords(input: EngineCalculationRequest): AdminOverrideRecord[] {
  return (input.adminOverrideRecords ?? []).map((record) => ({
    target: record.target as AdminOverrideRecord["target"],
    originalValue: record.originalValue,
    overrideValue: record.overrideValue,
    reason: record.reason,
    adminId: record.adminId,
    adminDisplayName: record.adminDisplayName,
    appliedAt: record.appliedAt.toISOString(),
  }));
}

export type VersionedCalculationSuccess = {
  ok: true;
  profileId: string;
  hsCode: string;
  hsCodeNormalized: string;
  classification: ReturnType<typeof classifyVehicleInput>;
  ruleSetVersion: string;
  engineResult: ReturnType<typeof runCalculationEngine>;
  estimateRange: ReturnType<typeof buildEstimateRange>;
  confidence: ConfidenceResult;
};

export type VersionedCalculationFailure = {
  ok: false;
  error: DutyEngineError;
};

export type VersionedCalculationOutcome = VersionedCalculationSuccess | VersionedCalculationFailure;

function buildVerifiedConfidence(profileId: string): ConfidenceResult {
  return {
    score: 88,
    label: "HIGH",
    level: "VERIFIED_PROFILE_HIGH",
    similarImportCount: 1,
    basisNote: `Verified rule profile ${profileId} with BoE-calibrated charge lines.`,
    reasons: ["Verified rule profile", "Bill of Entry calibration fixture", "Versioned rule set"],
    uncertaintyReasons: [],
  };
}

export function runVersionedCalculation(rawInput: unknown): VersionedCalculationOutcome {
  try {
    const input: EngineCalculationRequest = validateEngineRequest(rawInput);
    const overrideRecords = normalizeOverrideRecords(input);
    const overrideAudit = overrideRecords.length > 0 ? buildOverrideAuditSnapshot(overrideRecords) : undefined;

    const valueOverrides = applyValueOverrides(
      {
        fobGhs: input.values.fobGhs,
        freightGhs: input.values.freightGhs,
        insuranceGhs: input.values.insuranceGhs,
        cifGhs: input.values.cifGhs,
        customsValueGhs: input.values.customsValueGhs,
        hsCodeOverride: input.classification.hsCodeOverride,
      },
      overrideRecords,
    );

    const hsProfile = requireHsProfile({
      hsCode: input.classification.hsCode,
      hsCodeOverride: valueOverrides.hsCodeOverride,
      fuelType: input.classification.fuelType,
      engineCc: input.classification.engineCc,
      powerKw: input.classification.powerKw,
      vehicleCategory: input.classification.vehicleCategory,
      manufactureYear: input.classification.manufactureYear,
      make: input.classification.make,
      model: input.classification.model,
    });

    const ruleSet = resolveRuleSet({
      profileId: hsProfile.profileId,
      assessmentDate: input.assessmentDate,
    });

    const values = resolveCustomsValue({
      fobGhs: valueOverrides.fobGhs ?? input.values.fobGhs,
      freightGhs: valueOverrides.freightGhs ?? input.values.freightGhs,
      insuranceGhs: valueOverrides.insuranceGhs ?? input.values.insuranceGhs,
      customsValueOverride: valueOverrides.customsValueGhs ?? input.values.customsValueGhs,
      cifOverride: valueOverrides.cifGhs ?? input.values.cifGhs,
      depreciationPercent: input.values.depreciatedCustomsValueGhs,
    });

    const classification = classifyVehicleInput({
      vehicleCategory: input.classification.vehicleCategory,
      fuelType: input.classification.fuelType,
      engineCc: input.classification.engineCc,
      powerKw: input.classification.powerKw,
      manufactureYear: input.classification.manufactureYear,
      assessmentDate: input.assessmentDate,
    });

    const chargeOverrides = mergeLegacyChargeOverrides(
      buildChargeOverrideMap(overrideRecords),
      input.adminOverrides,
    );

    const engineResult = runCalculationEngine({
      assessmentDate: input.assessmentDate,
      ruleSet,
      fobGhs: valueOverrides.fobGhs ?? input.values.fobGhs,
      freightGhs: valueOverrides.freightGhs ?? input.values.freightGhs,
      insuranceGhs: valueOverrides.insuranceGhs ?? input.values.insuranceGhs,
      customsValueGhs: values.customsValueGhs,
      cifGhs: values.cifGhs,
      documentedTotalGhs: input.documentedTotalGhs,
      adminOverrides: chargeOverrides,
      overrideAudit,
    });

    const estimateRange = buildEstimateRange({
      baseGhs: engineResult.totalDutyPayableGhs,
      verifiedProfile: ruleSet.verificationStatus === "VERIFIED",
    });

    return {
      ok: true,
      profileId: hsProfile.profileId,
      hsCode: hsProfile.hsCode,
      hsCodeNormalized: hsProfile.hsCodeNormalized,
      classification,
      ruleSetVersion: engineResult.ruleSetVersion,
      engineResult,
      estimateRange,
      confidence: buildVerifiedConfidence(hsProfile.profileId),
    };
  } catch (error) {
    if (isEngineError(error)) {
      return { ok: false, error };
    }
    return {
      ok: false,
      error: engineError("ADMIN_REVIEW_REQUIRED", error instanceof Error ? error.message : "Calculation failed"),
    };
  }
}

export function runVersionedCalculationFromSnapshot(params: {
  hsCode: string;
  fuelType: string;
  manufactureYear: number;
  assessmentDate: Date;
  fobGhs: number;
  freightGhs: number;
  insuranceGhs: number;
  customsValueGhs: number;
  documentedTotalGhs: number;
  vehicleCategory?: string;
  engineCc?: number;
  powerKw?: number;
}): VersionedCalculationOutcome {
  return runVersionedCalculation({
    assessmentDate: params.assessmentDate,
    documentedTotalGhs: params.documentedTotalGhs,
    values: {
      fobGhs: params.fobGhs,
      freightGhs: params.freightGhs,
      insuranceGhs: params.insuranceGhs,
      customsValueGhs: params.customsValueGhs,
      cifGhs: params.customsValueGhs,
    },
    classification: {
      hsCode: params.hsCode,
      fuelType: params.fuelType,
      manufactureYear: params.manufactureYear,
      vehicleCategory: params.vehicleCategory,
      engineCc: params.engineCc,
      powerKw: params.powerKw,
    },
  });
}
