import "server-only";

import { prisma } from "@/lib/prisma";

import {
  ADMIN_CONFIG_INIT_HINT,
  checkDutyConfigHealth,
  USER_CONFIG_UNAVAILABLE_MESSAGE,
} from "@/lib/duty-intelligence/config-bootstrap.server";
import { buildEstimateFingerprint, dutyCacheGet, dutyCacheSet, estimateCacheKey } from "@/lib/duty-intelligence/cache.server";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { estimateFreight, freightToLineItem } from "@/lib/duty-intelligence/engines/freight-engine";
import { estimateInsurance, insuranceToLineItem } from "@/lib/duty-intelligence/engines/insurance-engine";
import { runVersionedCalculation } from "@/lib/duty-intelligence/engine-orchestrator";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "@/lib/duty-intelligence/formula-version";
import { linesToCalculationLineItems } from "@/lib/duty-intelligence/line-normalizer";
import { findSimilarImports } from "@/lib/duty-intelligence/prediction";
import { mergePredictionIntoResult, runPredictionLayer } from "@/lib/duty-intelligence/prediction-layer";
import { resolveHsProfile } from "@/lib/duty-intelligence/hs-profile-resolver";
import {
  classifyVehicle,
  resolveHsCode,
} from "@/lib/duty-intelligence/stages/vehicle-classification";
import {
  computeFobGhs,
  resolveExchangeRate,
} from "@/lib/duty-intelligence/stages/value-chain";
import { reconcilePayableDutyLines } from "@/lib/duty-intelligence/charge-reconciliation";
import {
  buildValuationChain,
  computeLandedCostGhs,
  resolvePricingBasis,
} from "@/lib/duty-intelligence/valuation-resolver";
import type {
  CalculationLineItem,
  DutyCalculationInput,
  DutyIntelligenceResult,
  DutyPipelineError,
  PipelineStageResult,
} from "@/lib/duty-intelligence/types";

function mapFuelType(fuelType: string): string {
  if (fuelType === "GASOLINE_PETROL") return "GASOLINE";
  if (fuelType === "GASOLINE_DIESEL") return "DIESEL";
  if (fuelType === "PLUGIN_HYBRID") return "PLUGIN_HYBRID";
  if (fuelType === "HYBRID") return "HYBRID";
  return fuelType;
}

export async function runDutyIntelligencePipeline(
  input: DutyCalculationInput,
  referenceYear = new Date().getFullYear(),
): Promise<DutyIntelligenceResult | DutyPipelineError> {
  const config = await loadCountryConfigSafe(input.countryCode);
  if (!config) {
    const health = await checkDutyConfigHealth(input.countryCode);
    return {
      code: "CONFIG_UNAVAILABLE",
      message: USER_CONFIG_UNAVAILABLE_MESSAGE,
      adminHint: ADMIN_CONFIG_INIT_HINT,
      health,
    };
  }

  const assessmentDate = new Date();
  const stages: PipelineStageResult[] = [];
  const allLineItems: CalculationLineItem[] = [];

  const classificationLegacy = classifyVehicle(input, referenceYear);
  const hsFromVehicle = resolveHsCode({ input, hsCodes: config.hsCodes, classification: classificationLegacy });

  const hsResolutionPreview = resolveHsProfile({
    hsCode: input.hsCodeOverride ?? hsFromVehicle.code.replace(/\./g, ""),
    hsCodeOverride: input.hsCodeOverride,
    fuelType: mapFuelType(input.vehicle.fuelType),
    engineCc: input.vehicle.engineCc,
    vehicleCategory: input.vehicle.vehicleCategory,
    manufactureYear: input.vehicle.year,
    make: input.vehicle.manufacturer,
    model: input.vehicle.model,
  });

  if (!hsResolutionPreview) {
    return {
      code: "NEEDS_CLASSIFICATION",
      message: "Unable to resolve HS code profile. Provide HS code override or complete vehicle classification.",
      missingFields: ["hsCodeOverride", "engineCc"],
    };
  }

  stages.push({
    stage: "HS_CODE_RESOLUTION",
    label: "HS Code Resolution",
    output: hsResolutionPreview,
    lineItems: [],
    notes: [`Method: ${hsResolutionPreview.method}`, hsResolutionPreview.description],
  });

  const exchange = await resolveExchangeRate({ countryConfigId: config.countryConfigId, input });
  allLineItems.push(...exchange.lineItems);
  stages.push({
    stage: "EXCHANGE_RATE",
    label: "Exchange Rate",
    output: { rate: exchange.rate, source: exchange.source },
    lineItems: exchange.lineItems,
    notes: exchange.notes,
  });

  const pricingBasis = resolvePricingBasis({
    declared: input.purchase.pricingBasis,
    cifGhsOverride: input.cifGhsOverride,
  });

  // Always keep purchase FOB as FOB — never assign CIF override into FOB.
  const purchaseFobGhs = computeFobGhs(input.purchase.fobAmount, exchange.rate);

  const freightEstimate = await estimateFreight({
    countryConfigId: config.countryConfigId,
    input,
    fobGhs: purchaseFobGhs,
  });
  const freightGhsResolved = input.shipping.freightGhsOverride ?? freightEstimate.freightGhs;

  if (
    freightGhsResolved <= 0 &&
    input.shipping.freightGhsOverride == null &&
    freightEstimate.source !== "OVERRIDE"
  ) {
    // Zero freight is only allowed when explicitly overridden/verified.
    // Matrix/fallback paths always return >0; this guards misconfigured zeros.
    return {
      code: "FREIGHT_REQUIRED",
      message:
        "Freight could not be resolved from shipping configuration. Provide freight or update the shipping-cost matrix.",
      missingFields: ["shipping.freightGhsOverride"],
      adminHint: "Configure Duty Shipping Cost Matrix or enter an authorized freight override.",
    };
  }

  // For CIF-declared purchases that reused CIF as the "FOB" field, do not insure CIF+freight.
  const fobForInsurance =
    pricingBasis === "CIF" &&
    input.cifGhsOverride != null &&
    Math.abs(purchaseFobGhs - input.cifGhsOverride) < 0.02
      ? Math.max(0, input.cifGhsOverride - freightGhsResolved)
      : purchaseFobGhs;

  const insuranceEstimate = await estimateInsurance({
    countryConfigId: config.countryConfigId,
    input,
    fobGhs: fobForInsurance,
    freightGhs: freightGhsResolved,
  });
  const insuranceGhsResolved =
    input.shipping.insuranceGhsOverride ?? insuranceEstimate.insuranceGhs;
  const otherGhs = input.shipping.otherShippingChargesGhs ?? 0;

  const valuation = buildValuationChain({
    pricingBasis,
    purchaseFobGhs,
    freightGhs: freightGhsResolved,
    insuranceGhs: insuranceGhsResolved,
    otherGhs,
    cifGhsOverride: input.cifGhsOverride,
  });

  const { fobGhs, freightGhs, insuranceGhs, cifGhs, customsValueGhs } = valuation;

  if (!(customsValueGhs > 0)) {
    return {
      code: "MISSING_CUSTOMS_VALUE",
      message: "Customs value could not be calculated from FOB, freight and insurance.",
      missingFields: ["purchase.fobAmount"],
    };
  }

  const valueLineItems: CalculationLineItem[] = [
    {
      code: "FOB",
      label: "FOB (Free On Board)",
      category: "FOB",
      amountGhs: fobGhs,
      basis: valuation.fobInferredFromCif
        ? "Inferred from CIF − Freight − Insurance"
        : `${input.purchase.fobAmount} ${input.purchase.fobCurrency} × ${exchange.rate}`,
      formula: valuation.fobInferredFromCif
        ? `CIF ${cifGhs} − Freight ${freightGhs} − Insurance ${insuranceGhs} = ${fobGhs}`
        : `${input.purchase.fobAmount} × ${exchange.rate} = ${fobGhs}`,
      source: valuation.fobInferredFromCif ? "OVERRIDE" : "CONFIG",
    },
    freightToLineItem({ ...freightEstimate, freightGhs }),
    insuranceToLineItem({ ...insuranceEstimate, insuranceGhs }),
    {
      code: "CIF",
      label: "CIF (Cost, Insurance, Freight)",
      category: "CIF",
      amountGhs: cifGhs,
      basis: valuation.cifOverridden
        ? "Declared / override CIF (freight not added twice)"
        : "FOB + Freight + Insurance + Other",
      formula: valuation.cifOverridden
        ? `Override CIF ${cifGhs}`
        : `${fobGhs} + ${freightGhs} + ${insuranceGhs} + ${otherGhs} = ${cifGhs}`,
      source: valuation.cifOverridden ? "OVERRIDE" : "CONFIG",
    },
    {
      code: "CUSTOMS_VALUE",
      label: "Customs Value",
      category: "CUSTOMS",
      amountGhs: customsValueGhs,
      basis: "Declared customs valuation (typically CIF)",
      formula: `Customs Value = CIF ${customsValueGhs}`,
      source: "CONFIG",
    },
  ];
  allLineItems.push(...valueLineItems);
  stages.push({
    stage: "VALUE_CHAIN",
    label: "FOB → Freight → Insurance → CIF → Customs Value",
    output: {
      pricingBasis: valuation.pricingBasis,
      fobGhs,
      freightGhs,
      insuranceGhs,
      cifGhs,
      customsValueGhs,
      freightSource: freightEstimate.source,
      insuranceRate: insuranceEstimate.percentageRate,
      cifOverridden: valuation.cifOverridden,
      fobInferredFromCif: valuation.fobInferredFromCif,
    },
    lineItems: valueLineItems,
    notes: [...valuation.notes, freightEstimate.basis, insuranceEstimate.basis],
  });

  const versioned = runVersionedCalculation({
    assessmentDate,
    values: {
      fobGhs,
      freightGhs,
      insuranceGhs,
      customsValueGhs,
      cifGhs,
    },
    classification: {
      hsCode: hsResolutionPreview.hsCode,
      hsCodeOverride: input.hsCodeOverride,
      fuelType: mapFuelType(input.vehicle.fuelType),
      engineCc: input.vehicle.engineCc,
      vehicleCategory: input.vehicle.vehicleCategory,
      manufactureYear: input.vehicle.year,
      make: input.vehicle.manufacturer,
      model: input.vehicle.model,
    },
  });

  if (!versioned.ok) {
    return {
      code: versioned.error.code,
      message: versioned.error.message,
      missingFields: versioned.error.missingFields,
      details: versioned.error.details,
      adminHint: ADMIN_CONFIG_INIT_HINT,
    };
  }

  const taxLineItems = linesToCalculationLineItems(versioned.engineResult.lines);
  allLineItems.push(...taxLineItems);
  stages.push({
    stage: "DUTY_ENGINE",
    label: "Versioned Duty & Levy Engine",
    output: {
      ruleSetVersion: versioned.ruleSetVersion,
      profileId: versioned.profileId,
      lineCount: taxLineItems.length,
    },
    lineItems: taxLineItems,
    notes: [
      `Rule set ${versioned.ruleSetVersion}`,
      `Profile ${versioned.profileId}`,
      "Dependency-aware calculation with decimal-safe arithmetic.",
    ],
  });

  const reconciliation = reconcilePayableDutyLines(taxLineItems, {
    expectedTotalGhs: versioned.engineResult.totalDutyPayableGhs,
  });

  if (!reconciliation.withinTolerance) {
    console.error("[duty-pipeline] reconciliation mismatch", {
      lineItemSumGhs: reconciliation.lineItemSumGhs,
      engineTotal: versioned.engineResult.totalDutyPayableGhs,
      difference: reconciliation.reconciliationDifferenceGhs,
      duplicates: reconciliation.duplicateKeysDropped,
    });
    return {
      code: "CALCULATION_RECONCILIATION_ERROR",
      message:
        "Duty lines could not be reconciled to a single total. Please retry or contact an administrator.",
      details: {
        lineItemSumGhs: reconciliation.lineItemSumGhs,
        engineTotalGhs: versioned.engineResult.totalDutyPayableGhs,
        reconciliationDifferenceGhs: reconciliation.reconciliationDifferenceGhs,
      },
      adminHint: "Inspect charge keys / duplicate aliases in the active duty rule set.",
    };
  }

  // Authoritative total = unique payable line sum (never a separate formula).
  const totalGraTaxesGhs = reconciliation.totalEstimatedDutyPayableGhs;
  const totalLandedCostGhs = computeLandedCostGhs({
    customsValueGhs,
    totalEstimatedDutyPayableGhs: totalGraTaxesGhs,
  });
  const payableDutyLines: CalculationLineItem[] = reconciliation.payableLines.map((l) => ({
    code: l.code,
    label: l.label,
    category: l.category,
    amountGhs: l.amountGhs,
    basis: l.basis,
    formula: l.formula,
    rate: l.rate,
    rateType: l.rateType,
    source: l.source,
  }));

  const similarImports = await findSimilarImports({
    countryConfigId: config.countryConfigId,
    input,
    hsCode: versioned.hsCodeNormalized,
  });

  const vehicleDataComplete =
    input.vehicle.fuelType === "ELECTRIC"
      ? Boolean(input.vehicle.engineCc || input.vehicle.batteryKwh)
      : Boolean(input.vehicle.engineCc);

  const fingerprint = buildEstimateFingerprint({
    make: input.vehicle.manufacturer,
    model: input.vehicle.model,
    year: input.vehicle.year,
    fuelType: mapFuelType(input.vehicle.fuelType),
    fobAmount: input.purchase.fobAmount,
    fobCurrency: input.purchase.fobCurrency,
    hsCode: versioned.hsCodeNormalized,
    profileId: versioned.profileId,
    ruleSetVersion: versioned.ruleSetVersion,
    fxRate: exchange.rate,
    fxEffectiveDate: exchange.effectiveDate,
    engineCc: input.vehicle.engineCc,
    vehicleCategory: input.vehicle.vehicleCategory,
    freightGhs,
    insuranceGhs,
  });

  const cacheKey = estimateCacheKey(fingerprint);
  const cached = await dutyCacheGet<DutyIntelligenceResult>(cacheKey, fingerprint);
  if (cached) {
    return { ...cached, calculatedAt: assessmentDate.toISOString() };
  }

  const prediction = await runPredictionLayer({
    countryConfigId: config.countryConfigId,
    input,
    hsCode: versioned.hsCode,
    hsCodeNormalized: versioned.hsCodeNormalized,
    profileId: versioned.profileId,
    profileDescription: hsResolutionPreview.description,
    ruleSetVersion: versioned.ruleSetVersion,
    verifiedProfile: versioned.confidence.level === "VERIFIED_PROFILE_HIGH",
    hsResolutionMethod: hsResolutionPreview.method,
    fobGhs,
    freightGhs,
    insuranceGhs,
    customsValueGhs,
    cifGhs,
    totalDutyGhs: totalGraTaxesGhs,
    totalLandedCostGhs,
    fxRate: exchange.rate,
    fxSource: exchange.source,
    fxEffectiveDate: exchange.effectiveDate,
    assessmentDate,
    vehicleDataComplete,
    similarImports,
  });

  const baseResult: DutyIntelligenceResult = {
    formulaVersion: DUTY_INTELLIGENCE_FORMULA_VERSION,
    countryCode: input.countryCode,
    inputs: input,
    stages,
    lineItems: allLineItems,
    summary: {
      fobGhs,
      freightGhs,
      insuranceGhs,
      cifGhs,
      customsValueGhs,
      totalGraTaxesGhs,
      totalPortChargesGhs: 0,
      shippingLineChargesGhs: 0,
      agentFeesGhs: 0,
      totalLandedCostGhs,
      estimatedTransitDays: freightEstimate.transitDays,
      pricingBasis: valuation.pricingBasis,
      lineItemSumGhs: reconciliation.lineItemSumGhs,
      reconciliationDifferenceGhs: reconciliation.reconciliationDifferenceGhs,
    },
    calculatedAt: assessmentDate.toISOString(),
    hsCode: versioned.hsCodeNormalized,
    hsCodeResolution: {
      code: versioned.hsCodeNormalized,
      description: hsResolutionPreview.description,
      method: hsResolutionPreview.method,
    },
    exchangeRate: {
      rate: exchange.rate,
      source: exchange.source,
      fromCurrency: exchange.fromCurrency,
      effectiveDate: exchange.effectiveDate,
    },
    vehicleClassification: {
      category: versioned.classification.category,
      ageYears: versioned.classification.ageYears,
      commercial: versioned.classification.commercial,
      profile: versioned.classification.profile,
    },
    confidence: prediction.confidence,
    historicalComparison: prediction.historicalComparison,
    predictionAdjustments: prediction.predictionAdjustments,
    ruleSetVersion: versioned.ruleSetVersion,
    profileId: versioned.profileId,
    estimateRange: prediction.estimateRange,
    explanation: prediction.explanation,
    calibration: {
      cohortSize: prediction.calibration.cohortSize,
      exactFixtureMatch: prediction.calibration.exactFixtureMatch,
      valuationMethod: prediction.calibration.valuation.method,
      assumptions: [
        ...prediction.calibration.assumptions,
        ...valuation.notes,
        `Freight source: ${freightEstimate.source}`,
        `Insurance source: ${insuranceEstimate.source}`,
      ],
    },
    cacheFingerprint: fingerprint,
    engineReconciliation: versioned.engineResult.reconciliation,
    payableDutyLines,
    methodologyNote:
      "Duty Intelligence Engine V4 with calibration layer — deterministic rule-based tax lines plus cohort-informed confidence and ranges. " +
      "FOB, freight and insurance stay separate; Total Estimated Duty Payable equals the unique duty-line sum. " +
      "Estimates are for planning only; final customs assessment is determined by Ghana Customs at clearance.",
  };

  const result = mergePredictionIntoResult(baseResult, prediction, { cacheFingerprint: fingerprint });
  await dutyCacheSet(cacheKey, result, { fingerprint, ttlMs: 5 * 60 * 1000 });
  return result;
}

export function isPipelineError(r: DutyIntelligenceResult | DutyPipelineError): r is DutyPipelineError {
  return "code" in r && r.code !== undefined && !("formulaVersion" in r);
}

export async function saveDutyCalculation(params: {
  input: DutyCalculationInput;
  result: DutyIntelligenceResult;
  createdById?: string;
  status?: "DRAFT" | "SAVED";
}): Promise<{ id: string; referenceNumber: string }> {
  const config = await loadCountryConfigSafe(params.input.countryCode);
  if (!config) throw new Error("Configuration unavailable");

  const { customAlphabet } = await import("nanoid");
  const nanoid = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
  const referenceNumber = `DI-${nanoid()}`;

  const row = await prisma.dutyCalculation.create({
    data: {
      countryConfigId: config.countryConfigId,
      referenceNumber,
      status: params.status ?? "SAVED",
      carId: params.input.carId,
      createdById: params.createdById,
      inputJson: params.input as object,
      resultJson: params.result as object,
      formulaVersion: params.result.formulaVersion,
      ruleSetVersion: params.result.ruleSetVersion ?? params.result.formulaVersion,
      classificationProfileId: params.result.profileId,
      formulaSnapshotJson: params.result.ruleSetVersion ? ({ version: params.result.ruleSetVersion } as object) : undefined,
      lineSnapshotsJson: params.result.lineItems as object,
      confidenceScore: params.result.confidence.score,
      confidenceLabel: params.result.confidence.level,
      confidenceLevel: params.result.confidence.label,
      predictedTotalGhs: params.result.summary.totalGraTaxesGhs,
      predictedLowGhs: params.result.estimateRange?.lowGhs,
      predictedHighGhs: params.result.estimateRange?.highGhs,
      similarImportCount: params.result.confidence.similarImportCount,
      totalLandedCostGhs: params.result.summary.totalLandedCostGhs,
      totalGraTaxesGhs: params.result.summary.totalGraTaxesGhs,
      totalPortChargesGhs: 0,
      cifGhs: params.result.summary.cifGhs,
      customsValueGhs: params.result.summary.customsValueGhs,
      hsCode: params.result.hsCode,
    },
  });

  return { id: row.id, referenceNumber };
}
