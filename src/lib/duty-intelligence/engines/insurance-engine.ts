import type { DutyExportCountry, DutyShippingMethod } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { CalculationLineItem, DutyCalculationInput } from "../types";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export type InsuranceEstimate = {
  insuranceGhs: number;
  percentageRate: number;
  source: "CONFIG" | "HISTORICAL" | "OVERRIDE";
  basis: string;
  formula: string;
};

const DEFAULT_INSURANCE_RATE = 0.015;

export function calculateInsuranceAmount(params: {
  fobGhs: number;
  freightGhs: number;
  percentageRate: number;
  minimumGhs?: number;
}): number {
  const insurableBase = params.fobGhs + params.freightGhs;
  let insuranceGhs = Math.round(insurableBase * params.percentageRate * 100) / 100;
  if (params.minimumGhs != null && params.minimumGhs > 0 && insuranceGhs < params.minimumGhs) {
    insuranceGhs = params.minimumGhs;
  }
  return insuranceGhs;
}

function normalizeOrigin(value?: string | null): DutyExportCountry | null {
  if (!value) return null;
  const v = value.toUpperCase().replace(/\s+/g, "_");
  const valid = ["CHINA", "JAPAN", "USA", "UK", "GERMANY", "KOREA", "DUBAI", "SINGAPORE", "THAILAND", "MALAYSIA", "OTHER"];
  return valid.includes(v) ? (v as DutyExportCountry) : "OTHER";
}

export async function estimateInsurance(params: {
  countryConfigId: string;
  input: DutyCalculationInput;
  fobGhs: number;
  freightGhs: number;
}): Promise<InsuranceEstimate> {
  const { input, countryConfigId, fobGhs, freightGhs } = params;

  if (input.shipping.insuranceGhsOverride != null && input.shipping.insuranceGhsOverride >= 0) {
    return {
      insuranceGhs: input.shipping.insuranceGhsOverride,
      percentageRate: 0,
      source: "OVERRIDE",
      basis: "Admin or user insurance override",
      formula: `Override GHS ${input.shipping.insuranceGhsOverride}`,
    };
  }

  const origin = normalizeOrigin(input.vehicle.countryOfOrigin);
  const method = input.shipping.shippingMethod;

  const rules = await prisma.dutyInsuranceRule.findMany({
    where: { countryConfigId, active: true },
    orderBy: { createdAt: "asc" },
  });

  let rule = rules.find((r) => r.originCountry === origin && r.shippingMethod === method);
  if (!rule) rule = rules.find((r) => r.originCountry === origin && r.shippingMethod == null);
  if (!rule) rule = rules.find((r) => r.originCountry == null && r.shippingMethod === method);
  if (!rule) rule = rules.find((r) => r.originCountry == null && r.shippingMethod == null);

  const rate = rule ? toNum(rule.percentageRate) : DEFAULT_INSURANCE_RATE;
  const minimum = rule?.minimumGhs != null ? toNum(rule.minimumGhs) : 0;
  const insuranceGhs = calculateInsuranceAmount({ fobGhs, freightGhs, percentageRate: rate, minimumGhs: minimum || undefined });

  return {
    insuranceGhs,
    percentageRate: rate,
    source: rule ? "CONFIG" : "HISTORICAL",
    basis: rule
      ? `Marine cargo insurance at ${(rate * 100).toFixed(2)}% of (FOB + Freight)`
      : `Default marine insurance at ${(rate * 100).toFixed(2)}% of (FOB + Freight)`,
    formula: `(${fobGhs} + ${freightGhs}) × ${rate} = ${insuranceGhs}`,
  };
}

export function insuranceToLineItem(estimate: InsuranceEstimate): CalculationLineItem {
  return {
    code: "INSURANCE",
    label: "Insurance",
    category: "INSURANCE",
    amountGhs: estimate.insuranceGhs,
    basis: estimate.basis,
    formula: estimate.formula,
    rate: estimate.percentageRate,
    rateType: "PERCENTAGE",
    source: estimate.source,
  };
}
