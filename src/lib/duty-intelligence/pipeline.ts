import { prisma } from "@/lib/prisma";

import {
  ADMIN_CONFIG_INIT_HINT,
  checkDutyConfigHealth,
  USER_CONFIG_UNAVAILABLE_MESSAGE,
} from "@/lib/duty-intelligence/config-bootstrap";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { runChargeEngine } from "@/lib/duty-intelligence/engines/charge-engine";
import { runDutyFormulaEngine, sumByCategory } from "@/lib/duty-intelligence/engines/duty-formula-engine";
import { estimateFreight, freightToLineItem } from "@/lib/duty-intelligence/engines/freight-engine";
import { estimateInsurance, insuranceToLineItem } from "@/lib/duty-intelligence/engines/insurance-engine";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "@/lib/duty-intelligence/formula-version";
import { buildHistoricalComparison, computeConfidence } from "@/lib/duty-intelligence/confidence";
import { findSimilarImports } from "@/lib/duty-intelligence/prediction";
import {
  classifyVehicle,
  resolveHsCode,
} from "@/lib/duty-intelligence/stages/vehicle-classification";
import {
  computeCif,
  computeCustomsValue,
  computeFobGhs,
  resolveExchangeRate,
} from "@/lib/duty-intelligence/stages/value-chain";
import type {
  CalculationLineItem,
  DutyCalculationInput,
  DutyIntelligenceResult,
  DutyPipelineError,
  PipelineStageResult,
} from "@/lib/duty-intelligence/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  const stages: PipelineStageResult[] = [];
  const allLineItems: CalculationLineItem[] = [];

  const classification = classifyVehicle(input, referenceYear);
  stages.push({
    stage: "VEHICLE_CLASSIFICATION",
    label: "Vehicle Classification",
    output: classification,
    lineItems: [],
    notes: [
      `Profile: ${classification.profile}`,
      `Vehicle age: ${classification.ageYears} years`,
      `Commercial: ${classification.commercial}`,
    ],
  });

  const hsResolution = resolveHsCode({ input, hsCodes: config.hsCodes, classification });
  const hsDutyRateHint = config.hsCodes.find((h) => h.hsCode === hsResolution.code)?.dutyRateHint ?? null;
  stages.push({
    stage: "HS_CODE_RESOLUTION",
    label: "HS Code Resolution",
    output: hsResolution,
    lineItems: [],
    notes: [`Method: ${hsResolution.method}`, hsResolution.description],
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

  const fobGhs =
    input.cifGhsOverride != null ? input.cifGhsOverride : computeFobGhs(input.purchase.fobAmount, exchange.rate);

  const freightEstimate = await estimateFreight({ countryConfigId: config.countryConfigId, input, fobGhs });
  const insuranceEstimate = await estimateInsurance({
    countryConfigId: config.countryConfigId,
    input,
    fobGhs,
    freightGhs: freightEstimate.freightGhs,
  });
  const otherGhs = input.shipping.otherShippingChargesGhs ?? 0;

  const cifGhs = computeCif({
    fobGhs: input.cifGhsOverride != null ? 0 : fobGhs,
    freightGhs: freightEstimate.freightGhs,
    insuranceGhs: insuranceEstimate.insuranceGhs,
    otherGhs,
    override: input.cifGhsOverride,
  });
  const customsValueGhs = computeCustomsValue(cifGhs);

  const valueLineItems: CalculationLineItem[] = [
    {
      code: "FOB",
      label: "FOB (Free On Board)",
      category: "FOB",
      amountGhs: input.cifGhsOverride != null ? cifGhs : fobGhs,
      basis: input.cifGhsOverride
        ? "CIF override supplied"
        : `${input.purchase.fobAmount} ${input.purchase.fobCurrency} × ${exchange.rate}`,
      formula: input.cifGhsOverride ? `Override CIF ${cifGhs}` : `${input.purchase.fobAmount} × ${exchange.rate} = ${fobGhs}`,
      source: input.cifGhsOverride ? "OVERRIDE" : "CONFIG",
    },
    freightToLineItem(freightEstimate),
    insuranceToLineItem(insuranceEstimate),
    {
      code: "CIF",
      label: "CIF (Cost, Insurance, Freight)",
      category: "CIF",
      amountGhs: cifGhs,
      basis: "FOB + Freight + Insurance + Other",
      formula: `${input.cifGhsOverride != null ? cifGhs : fobGhs} + ${freightEstimate.freightGhs} + ${insuranceEstimate.insuranceGhs} + ${otherGhs} = ${cifGhs}`,
      source: "CONFIG",
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
    label: "FOB → CIF → Customs Value",
    output: {
      fobGhs,
      freightGhs: freightEstimate.freightGhs,
      insuranceGhs: insuranceEstimate.insuranceGhs,
      cifGhs,
      customsValueGhs,
      freightSource: freightEstimate.source,
      insuranceRate: insuranceEstimate.percentageRate,
    },
    lineItems: valueLineItems,
    notes: [freightEstimate.basis, insuranceEstimate.basis],
  });

  const taxLineItems = runDutyFormulaEngine({
    rules: config.formulaRules,
    calibrationFactors: config.calibrationFactors,
    ctx: {
      cifGhs,
      customsValueGhs,
      importDutyGhs: 0,
      levySubtotalGhs: 0,
      vatBaseGhs: 0,
      vehicleAgeYears: classification.ageYears,
      fuelType: input.vehicle.fuelType,
      applyEvDutyWaiver: input.vehicle.applyEvDutyWaiver,
      hsDutyRateHint,
    },
  });
  allLineItems.push(...taxLineItems);
  stages.push({
    stage: "DUTY_ENGINE",
    label: "Duty, Levy & VAT Engine",
    output: { lineCount: taxLineItems.length },
    lineItems: taxLineItems,
    notes: ["All rates loaded from configurable DutyFormulaRule records — not hardcoded."],
  });

  const totalGraTaxesGhs = round2(
    taxLineItems.filter((i) => ["DUTY", "LEVY", "VAT", "FEE"].includes(i.category)).reduce((s, i) => s + i.amountGhs, 0),
  );
  const estimatedDutyGhs = round2(
    taxLineItems.filter((i) => i.category === "DUTY" || i.category === "LEVY" || i.category === "VAT").reduce((s, i) => s + i.amountGhs, 0),
  );

  const portItems = runChargeEngine({
    templates: config.chargeTemplates,
    category: "PORT",
    cifGhs,
    calibrationFactors: config.calibrationFactors,
    source: "HISTORICAL",
  });
  const shippingItems = runChargeEngine({
    templates: config.chargeTemplates,
    category: "SHIPPING_LINE",
    cifGhs,
    calibrationFactors: config.calibrationFactors,
    source: "HISTORICAL",
  });
  const agentItems = runChargeEngine({
    templates: config.chargeTemplates,
    category: "AGENT",
    cifGhs,
    calibrationFactors: config.calibrationFactors,
    source: "HISTORICAL",
  });

  allLineItems.push(...portItems, ...shippingItems, ...agentItems);
  stages.push(
    { stage: "PORT_CHARGES", label: "Port Charges Engine", output: {}, lineItems: portItems, notes: [] },
    { stage: "SHIPPING_LINE", label: "Shipping Line Engine", output: {}, lineItems: shippingItems, notes: [] },
    { stage: "AGENT_FEES", label: "Agent Cost Engine", output: {}, lineItems: agentItems, notes: [] },
  );

  const totalPortChargesGhs = round2(sumByCategory(portItems, ["PORT"]));
  const shippingLineChargesGhs = round2(sumByCategory(shippingItems, ["SHIPPING_LINE"]));
  const agentFeesGhs = round2(sumByCategory(agentItems, ["AGENT"]));
  const totalLandedCostGhs = round2(cifGhs + totalGraTaxesGhs + totalPortChargesGhs + shippingLineChargesGhs + agentFeesGhs);

  const similarImports = await findSimilarImports({
    countryConfigId: config.countryConfigId,
    input,
    hsCode: hsResolution.code,
  });
  const confidence = computeConfidence(similarImports, input);
  const historicalComparison = buildHistoricalComparison({ similarImports, estimatedDutyGhs });

  const predictionAdjustments = Object.entries(config.calibrationFactors)
    .filter(([, v]) => v !== 1)
    .map(([category, factor]) => ({
      category,
      factor: factor as number,
      note: `Self-learning calibration factor applied (${(factor as number).toFixed(4)})`,
    }));

  return {
    formulaVersion: DUTY_INTELLIGENCE_FORMULA_VERSION,
    countryCode: input.countryCode,
    inputs: input,
    stages,
    lineItems: allLineItems,
    summary: {
      fobGhs: input.cifGhsOverride != null ? cifGhs : fobGhs,
      freightGhs: freightEstimate.freightGhs,
      insuranceGhs: insuranceEstimate.insuranceGhs,
      cifGhs,
      customsValueGhs,
      totalGraTaxesGhs,
      totalPortChargesGhs,
      shippingLineChargesGhs,
      agentFeesGhs,
      totalLandedCostGhs,
    },
    hsCode: hsResolution.code,
    hsCodeResolution: hsResolution,
    exchangeRate: {
      rate: exchange.rate,
      source: exchange.source,
      fromCurrency: exchange.fromCurrency,
      effectiveDate: exchange.effectiveDate,
    },
    vehicleClassification: classification,
    confidence,
    historicalComparison,
    predictionAdjustments,
    methodologyNote:
      "Duty Intelligence Engine V3 — freight and insurance are calculated automatically from the shipping cost matrix and insurance rules. " +
      "All tax rates and port charges are loaded from the database configuration. " +
      "Estimates are for planning only; authoritative amounts are determined by GRA / ICUMS at clearance. " +
      "Historical verified imports improve prediction accuracy over time.",
  };
}

export function isPipelineError(r: DutyIntelligenceResult | DutyPipelineError): r is DutyPipelineError {
  return "code" in r && r.code === "CONFIG_UNAVAILABLE";
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
      confidenceScore: params.result.confidence.score,
      confidenceLabel: params.result.confidence.label,
      similarImportCount: params.result.confidence.similarImportCount,
      totalLandedCostGhs: params.result.summary.totalLandedCostGhs,
      totalGraTaxesGhs: params.result.summary.totalGraTaxesGhs,
      totalPortChargesGhs:
        params.result.summary.totalPortChargesGhs +
        params.result.summary.shippingLineChargesGhs +
        params.result.summary.agentFeesGhs,
      cifGhs: params.result.summary.cifGhs,
      customsValueGhs: params.result.summary.customsValueGhs,
      hsCode: params.result.hsCode,
    },
  });

  return { id: row.id, referenceNumber };
}
