import { prisma } from "@/lib/prisma";

import { loadCountryConfig } from "@/lib/duty-intelligence/config-loader";
import { runChargeEngine } from "@/lib/duty-intelligence/engines/charge-engine";
import { runDutyFormulaEngine, sumByCategory } from "@/lib/duty-intelligence/engines/duty-formula-engine";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "@/lib/duty-intelligence/formula-version";
import { computeConfidence } from "@/lib/duty-intelligence/confidence";
import { findSimilarImports } from "@/lib/duty-intelligence/prediction";
import {
  classifyVehicle,
  resolveHsCode,
} from "@/lib/duty-intelligence/stages/vehicle-classification";
import {
  computeCif,
  computeCustomsValue,
  computeFobGhs,
  computeFreightInsurance,
  resolveExchangeRate,
} from "@/lib/duty-intelligence/stages/value-chain";
import type {
  CalculationLineItem,
  DutyCalculationInput,
  DutyIntelligenceResult,
  PipelineStageResult,
} from "@/lib/duty-intelligence/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function runDutyIntelligencePipeline(
  input: DutyCalculationInput,
  referenceYear = new Date().getFullYear(),
): Promise<DutyIntelligenceResult> {
  const config = await loadCountryConfig(input.countryCode);
  const stages: PipelineStageResult[] = [];
  const allLineItems: CalculationLineItem[] = [];

  // Stage 1: Vehicle classification
  const classification = classifyVehicle(input, referenceYear);
  stages.push({
    stage: "VEHICLE_CLASSIFICATION",
    label: "Vehicle Classification",
    output: classification,
    lineItems: [],
    notes: [`Vehicle age: ${classification.ageYears} years`, `Commercial: ${classification.commercial}`],
  });

  // Stage 2: HS Code resolution
  const hsResolution = resolveHsCode({
    input,
    hsCodes: config.hsCodes,
    classification,
  });
  const hsDutyRateHint =
    config.hsCodes.find((h) => h.hsCode === hsResolution.code)?.dutyRateHint ?? null;
  stages.push({
    stage: "HS_CODE_RESOLUTION",
    label: "HS Code Resolution",
    output: hsResolution,
    lineItems: [],
    notes: [`Method: ${hsResolution.method}`, hsResolution.description],
  });

  // Stage 3: Exchange rate
  const exchange = await resolveExchangeRate({ countryConfigId: config.countryConfigId, input });
  allLineItems.push(...exchange.lineItems);
  stages.push({
    stage: "EXCHANGE_RATE",
    label: "Exchange Rate",
    output: { rate: exchange.rate, source: exchange.source },
    lineItems: exchange.lineItems,
    notes: exchange.notes,
  });

  // Stage 4-7: FOB, Freight, Insurance, CIF
  const fobGhs =
    input.cifGhsOverride != null
      ? input.cifGhsOverride
      : computeFobGhs(input.purchase.fobAmount, exchange.rate);
  const { freightGhs, insuranceGhs, otherGhs } = computeFreightInsurance(input);
  const cifGhs = computeCif({
    fobGhs: input.cifGhsOverride != null ? 0 : fobGhs,
    freightGhs,
    insuranceGhs,
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
    {
      code: "FREIGHT",
      label: "Freight",
      category: "FREIGHT",
      amountGhs: freightGhs,
      basis: "Shipping freight to destination port",
      formula: `GHS ${freightGhs}`,
      source: freightGhs > 0 ? "CONFIG" : "HISTORICAL",
    },
    {
      code: "INSURANCE",
      label: "Insurance",
      category: "INSURANCE",
      amountGhs: insuranceGhs,
      basis: "Marine / cargo insurance",
      formula: `GHS ${insuranceGhs}`,
      source: insuranceGhs > 0 ? "CONFIG" : "HISTORICAL",
    },
    {
      code: "CIF",
      label: "CIF (Cost, Insurance, Freight)",
      category: "CIF",
      amountGhs: cifGhs,
      basis: "FOB + Freight + Insurance + Other",
      formula: `${fobGhs} + ${freightGhs} + ${insuranceGhs} + ${otherGhs} = ${cifGhs}`,
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
    output: { fobGhs, freightGhs, insuranceGhs, cifGhs, customsValueGhs },
    lineItems: valueLineItems,
    notes: [],
  });

  // Stage 8-10: Duty, VAT, Levy engines
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

  // Stage 11-13: Port, Shipping Line, Agent engines
  const shippingLine = config.shippingLines.find((s) => s.code === input.shipping.shippingLineCode);
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
    shippingLineId: shippingLine?.id,
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
    { stage: "SHIPPING_LINE", label: "Shipping Line Engine", output: { line: shippingLine?.name }, lineItems: shippingItems, notes: [] },
    { stage: "AGENT_FEES", label: "Agent Cost Engine", output: {}, lineItems: agentItems, notes: [] },
  );

  const totalPortChargesGhs = round2(sumByCategory(portItems, ["PORT"]));
  const shippingLineChargesGhs = round2(sumByCategory(shippingItems, ["SHIPPING_LINE"]));
  const agentFeesGhs = round2(sumByCategory(agentItems, ["AGENT"]));
  const totalLandedCostGhs = round2(cifGhs + totalGraTaxesGhs + totalPortChargesGhs + shippingLineChargesGhs + agentFeesGhs);

  // Prediction & confidence
  const similarImports = await findSimilarImports({
    countryConfigId: config.countryConfigId,
    input,
    hsCode: hsResolution.code,
  });
  const confidence = computeConfidence(similarImports);

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
      freightGhs,
      insuranceGhs,
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
    predictionAdjustments,
    methodologyNote:
      "Duty Intelligence Engine v1 — all tax rates and charges are loaded from the database configuration. " +
      "Estimates are for planning only; authoritative amounts are determined by GRA / ICUMS at clearance. " +
      "Historical verified imports improve prediction accuracy over time.",
  };
}

export async function saveDutyCalculation(params: {
  input: DutyCalculationInput;
  result: DutyIntelligenceResult;
  createdById?: string;
  status?: "DRAFT" | "SAVED";
}): Promise<{ id: string; referenceNumber: string }> {
  const config = await loadCountryConfig(params.input.countryCode);
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
      totalPortChargesGhs: params.result.summary.totalPortChargesGhs + params.result.summary.shippingLineChargesGhs + params.result.summary.agentFeesGhs,
      cifGhs: params.result.summary.cifGhs,
      customsValueGhs: params.result.summary.customsValueGhs,
      hsCode: params.result.hsCode,
    },
  });

  return { id: row.id, referenceNumber };
}
