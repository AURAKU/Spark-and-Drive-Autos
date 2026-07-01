import { prisma } from "@/lib/prisma";

import type { DutyCalculationInput, SimilarImportMatch } from "./types";

function similarityScore(params: {
  input: DutyCalculationInput;
  row: {
    manufacturer: string | null;
    model: string | null;
    year: number | null;
    fuelType: string | null;
    hsCode: string | null;
    engineCc: number | null;
    grossWeightKg: number | null;
    fobAmount: unknown;
    cifGhs: unknown;
  };
  hsCode: string;
}): number {
  let score = 0;
  const { input, row } = params;

  if (row.manufacturer && input.vehicle.manufacturer) {
    if (row.manufacturer.toLowerCase() === input.vehicle.manufacturer.toLowerCase()) score += 25;
    else if (row.manufacturer.toLowerCase().includes(input.vehicle.manufacturer.toLowerCase().slice(0, 3))) score += 10;
  }
  if (row.model && input.vehicle.model) {
    if (row.model.toLowerCase() === input.vehicle.model.toLowerCase()) score += 25;
    else if (row.model.toLowerCase().includes(input.vehicle.model.toLowerCase().slice(0, 3))) score += 10;
  }
  if (row.year != null && input.vehicle.year != null) {
    const diff = Math.abs(row.year - input.vehicle.year);
    if (diff === 0) score += 15;
    else if (diff <= 1) score += 10;
    else if (diff <= 3) score += 5;
  }
  if (row.fuelType === input.vehicle.fuelType) score += 15;
  if (row.hsCode === params.hsCode) score += 10;
  if (row.engineCc != null && input.vehicle.engineCc != null) {
    const pct = Math.abs(row.engineCc - input.vehicle.engineCc) / input.vehicle.engineCc;
    if (pct < 0.1) score += 5;
  }

  // FOB range proximity
  if (row.fobAmount != null && input.purchase.fobAmount > 0) {
    const fob = Number(row.fobAmount);
    const pct = Math.abs(fob - input.purchase.fobAmount) / input.purchase.fobAmount;
    if (pct < 0.15) score += 10;
    else if (pct < 0.3) score += 5;
  }

  return score;
}

export async function findSimilarImports(params: {
  countryConfigId: string;
  input: DutyCalculationInput;
  hsCode: string;
  limit?: number;
}): Promise<SimilarImportMatch[]> {
  const rows = await prisma.dutyVerifiedImport.findMany({
    where: {
      countryConfigId: params.countryConfigId,
      status: "VERIFIED",
    },
    orderBy: { verifiedAt: "desc" },
    take: 200,
    select: {
      id: true,
      manufacturer: true,
      model: true,
      year: true,
      fuelType: true,
      hsCode: true,
      engineCc: true,
      grossWeightKg: true,
      fobAmount: true,
      cifGhs: true,
      totalLandedCostGhs: true,
      totalDutyGhs: true,
      portChargesGhs: true,
      shippingLineGhs: true,
      agentFeesGhs: true,
    },
  });

  const scored = rows
    .map((row) => ({
      id: row.id,
      weight: similarityScore({ input: params.input, row, hsCode: params.hsCode }),
      manufacturer: row.manufacturer,
      model: row.model,
      year: row.year,
      totalLandedCostGhs: row.totalLandedCostGhs != null ? Number(row.totalLandedCostGhs) : null,
      totalDutyGhs: row.totalDutyGhs != null ? Number(row.totalDutyGhs) : null,
      portChargesGhs: row.portChargesGhs != null ? Number(row.portChargesGhs) : null,
      shippingLineGhs: row.shippingLineGhs != null ? Number(row.shippingLineGhs) : null,
      agentFeesGhs: row.agentFeesGhs != null ? Number(row.agentFeesGhs) : null,
    }))
    .filter((m) => m.weight >= 20)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, params.limit ?? 30);

  return scored;
}

export function weightedAverage(values: { value: number; weight: number }[]): number | null {
  const valid = values.filter((v) => v.value > 0 && v.weight > 0);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((s, v) => s + v.weight, 0);
  const sum = valid.reduce((s, v) => s + v.value * v.weight, 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}
