/**
 * @deprecated Superseded by `calculation-engine.ts` (V4 dependency-aware rule engine).
 * Retained temporarily for reference; do not use in new code paths.
 */
import type { EngineType } from "@prisma/client";

import type { CalculationLineItem, LoadedFormulaRule } from "../types";

type FormulaContext = {
  cifGhs: number;
  customsValueGhs: number;
  importDutyGhs: number;
  levySubtotalGhs: number;
  vatBaseGhs: number;
  vehicleAgeYears: number;
  fuelType: EngineType;
  applyEvDutyWaiver: boolean;
  hsDutyRateHint: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function matchesConditions(rule: LoadedFormulaRule, ctx: FormulaContext): boolean {
  const cond = rule.conditionsJson;
  if (!cond) return true;

  if (cond.powertrain != null && cond.powertrain !== ctx.fuelType) return false;
  if (cond.applyEvDutyWaiver === true && !ctx.applyEvDutyWaiver) return false;
  if (cond.applyEvDutyWaiver === false && ctx.applyEvDutyWaiver) return false;

  if (Array.isArray(cond.ageBands)) {
    const band = (cond.ageBands as { maxYears: number; rate: number }[]).find((b) => ctx.vehicleAgeYears <= b.maxYears);
    if (band && rule.code === "IMPORT_DUTY") {
      // handled in resolveRate
    }
  }

  return true;
}

function resolveRate(rule: LoadedFormulaRule, ctx: FormulaContext): { rate: number; note: string } {
  const cond = rule.conditionsJson;

  if (rule.code === "IMPORT_DUTY" && cond?.ageBands && Array.isArray(cond.ageBands)) {
    const bands = cond.ageBands as { maxYears: number; rate: number }[];
    const sorted = [...bands].sort((a, b) => a.maxYears - b.maxYears);
    const band = sorted.find((b) => ctx.vehicleAgeYears <= b.maxYears) ?? sorted[sorted.length - 1];
    return {
      rate: band.rate,
      note: `Age band ≤${band.maxYears}y → ${(band.rate * 100).toFixed(1)}% on ${rule.basis}`,
    };
  }

  if (rule.code === "IMPORT_DUTY" && ctx.fuelType === "ELECTRIC" && ctx.applyEvDutyWaiver) {
    return { rate: 0, note: "Modeled EV duty waiver scenario (0%)" };
  }

  if (rule.code === "IMPORT_DUTY" && ctx.hsDutyRateHint != null && rule.rateType === "BLENDED") {
    return {
      rate: ctx.hsDutyRateHint,
      note: `HS code duty rate hint ${(ctx.hsDutyRateHint * 100).toFixed(1)}%`,
    };
  }

  if (rule.rateType === "BLENDED" && cond?.blend) {
    const blend = cond.blend as { iceWeight: number; evRef: number };
    const iceRate =
      cond.ageBands && Array.isArray(cond.ageBands)
        ? ((cond.ageBands as { maxYears: number; rate: number }[]).find((b) => ctx.vehicleAgeYears <= b.maxYears)?.rate ?? rule.rateValue)
        : rule.rateValue;
    const rate = iceRate * blend.iceWeight + blend.evRef * (1 - blend.iceWeight);
    return { rate, note: `Blended rate ${(rate * 100).toFixed(2)}% (ICE ${blend.iceWeight * 100}% + EV ref ${blend.evRef * 100}%)` };
  }

  return {
    rate: rule.rateValue,
    note: rule.formulaNote ?? `${rule.rateType} rate ${rule.rateValue}`,
  };
}

function basisAmount(rule: LoadedFormulaRule, ctx: FormulaContext): number {
  switch (rule.basis) {
    case "CIF":
      return ctx.cifGhs;
    case "CUSTOMS_VALUE":
      return ctx.customsValueGhs;
    case "IMPORT_DUTY":
      return ctx.importDutyGhs;
    case "LEVY_SUBTOTAL":
      return ctx.levySubtotalGhs;
    case "VAT_BASE":
      return ctx.vatBaseGhs;
    case "FOB":
      return ctx.cifGhs; // FOB tracked in summary; use CIF proxy if needed
    case "FIXED":
      return 1;
    default:
      return ctx.customsValueGhs;
  }
}

export function runDutyFormulaEngine(params: {
  rules: LoadedFormulaRule[];
  ctx: FormulaContext;
  calibrationFactors: Record<string, number>;
}): CalculationLineItem[] {
  const items: CalculationLineItem[] = [];
  let importDutyGhs = 0;
  let levySubtotalGhs = 0;
  let vatBaseGhs = 0;
  let vatGhs = 0;

  const ctx = { ...params.ctx };

  const dutyRules = params.rules.filter((r) => matchesConditions(r, ctx));
  const levyCodes = new Set([
    "ECOWAS_LEVY",
    "EDA_LEVY",
    "NHIL",
    "GETFUND",
    "SPECIAL_IMPORT_LEVY",
    "EXIM_LEVY",
    "AU_LEVY",
    "INSPECTION_FEE",
    "PROCESSING_FEE",
    "NETWORK_CHARGES",
    "DISINFECTION_FEE",
  ]);

  for (const rule of dutyRules) {
    if (rule.code === "VAT") continue; // VAT computed after levies

    const { rate } = resolveRate(rule, ctx);
    const basis = basisAmount(rule, ctx);
    let amount = rule.rateType === "FIXED" ? rule.rateValue : round2(basis * rate);
    const calFactor = params.calibrationFactors[rule.code] ?? 1;
    if (calFactor !== 1) {
      amount = round2(amount * calFactor);
    }

    const category =
      rule.code === "IMPORT_DUTY"
        ? "DUTY"
        : levyCodes.has(rule.code)
          ? "LEVY"
          : rule.code.includes("FEE") || rule.code.includes("CHARGES")
            ? "FEE"
            : "LEVY";

    items.push({
      code: rule.code,
      label: rule.label,
      category,
      amountGhs: amount,
      basis: `${rule.basis} = ${basis.toLocaleString("en-GH")} GHS`,
      formula: rule.rateType === "FIXED" ? `Fixed GHS ${rule.rateValue}` : `${basis.toLocaleString("en-GH")} × ${(rate * 100).toFixed(2)}% = ${amount}`,
      rate,
      rateType: rule.rateType,
      source: calFactor !== 1 ? "PREDICTION" : "CONFIG",
    });

    if (rule.code === "IMPORT_DUTY") {
      importDutyGhs = amount;
      ctx.importDutyGhs = amount;
    } else if (category === "LEVY" || category === "FEE") {
      levySubtotalGhs += amount;
      ctx.levySubtotalGhs = levySubtotalGhs;
    }
  }

  vatBaseGhs = round2(ctx.cifGhs + importDutyGhs + levySubtotalGhs);
  ctx.vatBaseGhs = vatBaseGhs;

  const vatRule = dutyRules.find((r) => r.code === "VAT");
  if (vatRule) {
    const { rate, note } = resolveRate(vatRule, ctx);
    vatGhs = round2(vatBaseGhs * rate);
    const calFactor = params.calibrationFactors["VAT"] ?? 1;
    if (calFactor !== 1) vatGhs = round2(vatGhs * calFactor);
    items.push({
      code: "VAT",
      label: vatRule.label,
      category: "VAT",
      amountGhs: vatGhs,
      basis: `VAT base = ${vatBaseGhs.toLocaleString("en-GH")} GHS (CIF + duty + levies)`,
      formula: `${vatBaseGhs.toLocaleString("en-GH")} × ${(rate * 100).toFixed(1)}% = ${vatGhs}. ${note}`,
      rate,
      rateType: vatRule.rateType,
      source: "CONFIG",
    });
  }

  return items;
}

export function sumByCategory(items: CalculationLineItem[], categories: CalculationLineItem["category"][]): number {
  return round2(items.filter((i) => categories.includes(i.category)).reduce((s, i) => s + i.amountGhs, 0));
}
