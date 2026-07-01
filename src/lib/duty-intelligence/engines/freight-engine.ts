import type { DutyExportCountry, DutyShippingMethod, DutyVehicleCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { CalculationLineItem, DutyCalculationInput } from "../types";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export type FreightEstimate = {
  freightGhs: number;
  originCountry: DutyExportCountry;
  transitDays: number | null;
  containerType: string | null;
  source: "CONFIG" | "HISTORICAL" | "OVERRIDE";
  basis: string;
  formula: string;
};

function normalizeOriginCountry(value?: string | null): DutyExportCountry {
  const v = (value ?? "CHINA").toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, DutyExportCountry> = {
    CHINA: "CHINA",
    CN: "CHINA",
    JAPAN: "JAPAN",
    JP: "JAPAN",
    USA: "USA",
    US: "USA",
    UNITED_STATES: "USA",
    UK: "UK",
    GB: "UK",
    UNITED_KINGDOM: "UK",
    GERMANY: "GERMANY",
    DE: "GERMANY",
    KOREA: "KOREA",
    KR: "KOREA",
    SOUTH_KOREA: "KOREA",
    DUBAI: "DUBAI",
    UAE: "DUBAI",
    SINGAPORE: "SINGAPORE",
    SG: "SINGAPORE",
    THAILAND: "THAILAND",
    TH: "THAILAND",
    MALAYSIA: "MALAYSIA",
    MY: "MALAYSIA",
  };
  return map[v] ?? "OTHER";
}

/** Default freight fallbacks (GHS) when matrix row is missing — never crash. */
const FALLBACK_FREIGHT: Record<DutyExportCountry, Record<string, number>> = {
  CHINA: { SUV: 4200, SEDAN: 3800, PICKUP: 4500, TRUCK: 6200, BUS: 8500, VAN: 4000, DEFAULT: 4000 },
  JAPAN: { SUV: 4800, SEDAN: 4200, PICKUP: 5000, TRUCK: 6800, BUS: 9200, VAN: 4400, DEFAULT: 4500 },
  USA: { SUV: 7200, SEDAN: 6500, PICKUP: 7800, TRUCK: 9500, BUS: 12000, VAN: 6800, DEFAULT: 7000 },
  UK: { SUV: 6800, SEDAN: 6200, PICKUP: 7200, TRUCK: 9000, BUS: 11000, VAN: 6400, DEFAULT: 6600 },
  GERMANY: { SUV: 7000, SEDAN: 6400, PICKUP: 7400, TRUCK: 9200, BUS: 11200, VAN: 6600, DEFAULT: 6800 },
  KOREA: { SUV: 4600, SEDAN: 4000, PICKUP: 4800, TRUCK: 6600, BUS: 8800, VAN: 4200, DEFAULT: 4300 },
  DUBAI: { SUV: 5200, SEDAN: 4600, PICKUP: 5400, TRUCK: 7200, BUS: 9600, VAN: 4800, DEFAULT: 5000 },
  SINGAPORE: { SUV: 4400, SEDAN: 3900, PICKUP: 4600, TRUCK: 6400, BUS: 8600, VAN: 4100, DEFAULT: 4200 },
  THAILAND: { SUV: 4000, SEDAN: 3600, PICKUP: 4300, TRUCK: 6000, BUS: 8200, VAN: 3800, DEFAULT: 3900 },
  MALAYSIA: { SUV: 4100, SEDAN: 3700, PICKUP: 4400, TRUCK: 6100, BUS: 8300, VAN: 3900, DEFAULT: 4000 },
  OTHER: { SUV: 5000, SEDAN: 4500, PICKUP: 5200, TRUCK: 7000, BUS: 9000, VAN: 4700, DEFAULT: 4800 },
};

const METHOD_MULTIPLIER: Record<DutyShippingMethod, number> = {
  SEA_FREIGHT: 1,
  CONTAINER: 1.15,
  RORO: 0.85,
  AIR_FREIGHT: 4.5,
};

function fallbackFreight(
  origin: DutyExportCountry,
  category: DutyVehicleCategory | null | undefined,
  method: DutyShippingMethod,
): number {
  const cat = category ?? "SEDAN";
  const table = FALLBACK_FREIGHT[origin] ?? FALLBACK_FREIGHT.OTHER;
  const base = table[cat] ?? table.DEFAULT;
  return Math.round(base * (METHOD_MULTIPLIER[method] ?? 1));
}

export async function estimateFreight(params: {
  countryConfigId: string;
  input: DutyCalculationInput;
  fobGhs: number;
}): Promise<FreightEstimate> {
  const { input, countryConfigId } = params;

  if (input.shipping.freightGhsOverride != null && input.shipping.freightGhsOverride >= 0) {
    return {
      freightGhs: input.shipping.freightGhsOverride,
      originCountry: normalizeOriginCountry(input.vehicle.countryOfOrigin),
      transitDays: null,
      containerType: input.shipping.containerType ?? null,
      source: "OVERRIDE",
      basis: "Admin or user freight override",
      formula: `Override GHS ${input.shipping.freightGhsOverride}`,
    };
  }

  const origin = normalizeOriginCountry(input.vehicle.countryOfOrigin);
  const category = input.vehicle.vehicleCategory;
  const method = input.shipping.shippingMethod;
  const containerType = input.shipping.containerType ?? null;

  const rows = await prisma.dutyShippingCostMatrix.findMany({
    where: {
      countryConfigId,
      originCountry: origin,
      shippingMethod: method,
      active: true,
      OR: [{ vehicleCategory: category ?? undefined }, { vehicleCategory: null }],
    },
    orderBy: [{ vehicleCategory: "desc" }],
  });

  let match = rows.find((r) => r.vehicleCategory === category);
  if (!match) match = rows.find((r) => r.vehicleCategory == null);
  if (!match && containerType) {
    match = rows.find((r) => r.containerType === containerType);
  }

  if (match) {
    const freightGhs = toNum(match.freightGhs);
    return {
      freightGhs,
      originCountry: origin,
      transitDays: match.transitDays,
      containerType: match.containerType,
      source: "CONFIG",
      basis: `${origin.replace(/_/g, " ")} → Tema · ${method.replace(/_/g, " ")} · ${category ?? "General"}`,
      formula: `Matrix rate GHS ${freightGhs}${match.transitDays ? ` · ~${match.transitDays} days transit` : ""}`,
    };
  }

  const freightGhs = fallbackFreight(origin, category, method);
  return {
    freightGhs,
    originCountry: origin,
    transitDays: method === "AIR_FREIGHT" ? 7 : method === "RORO" ? 28 : 35,
    containerType,
    source: "HISTORICAL",
    basis: `${origin.replace(/_/g, " ")} → Tema · ${method.replace(/_/g, " ")} · estimated fallback`,
    formula: `Estimated GHS ${freightGhs} (no matrix row — using regional average)`,
  };
}

export function freightToLineItem(estimate: FreightEstimate): CalculationLineItem {
  return {
    code: "FREIGHT",
    label: "Freight",
    category: "FREIGHT",
    amountGhs: estimate.freightGhs,
    basis: estimate.basis,
    formula: estimate.formula,
    source: estimate.source,
  };
}
