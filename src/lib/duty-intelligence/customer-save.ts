import { prisma } from "@/lib/prisma";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { saveDutyCalculation } from "@/lib/duty-intelligence/pipeline";
import { emitDutyEvent } from "@/lib/duty-intelligence/observability/events";
import { mapFuelType } from "@/lib/duty-intelligence/fuel-type";

export async function upsertTemporaryVehicleProfile(input: DutyCalculationInput, createdById?: string): Promise<string | null> {
  if (input.carId) return null;

  const fuelType = mapFuelType(input.vehicle.fuelType);
  const hsDigits = input.hsCodeOverride?.replace(/\D/g, "") ?? "";

  const profile = await prisma.dutyVehicleProfile.create({
    data: {
      make: input.vehicle.manufacturer,
      model: input.vehicle.model,
      vin: input.vehicle.vin,
      manufactureYear: input.vehicle.year,
      fuelType: fuelType as never,
      engineCc: input.vehicle.engineCc,
      powerKw: input.vehicle.batteryKwh,
      hsCode: hsDigits || "UNVERIFIED",
      countryOfOrigin: input.vehicle.countryOfOrigin,
      vehicleCategory: input.vehicle.vehicleCategory,
      createdById,
    },
    select: { id: true },
  });

  return profile.id;
}

export async function saveCustomerDutyEstimate(params: {
  input: DutyCalculationInput;
  result: DutyIntelligenceResult;
  userId: string;
}): Promise<{ id: string; referenceNumber: string; vehicleProfileId: string | null }> {
  const vehicleProfileId = await upsertTemporaryVehicleProfile(params.input, params.userId);

  const saved = await saveDutyCalculation({
    input: params.input,
    result: params.result,
    createdById: params.userId,
    status: "SAVED",
  });

  if (vehicleProfileId) {
    await prisma.dutyCalculation.update({
      where: { id: saved.id },
      data: { vehicleProfileId },
    });
  }

  emitDutyEvent({
    event: "estimate_saved",
    referenceNumber: saved.referenceNumber,
    calculationId: saved.id,
    userId: params.userId,
    profileId: params.result.profileId,
    ruleSetVersion: params.result.ruleSetVersion,
    confidenceLevel: params.result.confidence.level,
  });

  return { ...saved, vehicleProfileId };
}

export async function getCustomerCalculation(calculationId: string, userId: string) {
  return prisma.dutyCalculation.findFirst({
    where: { id: calculationId, createdById: userId },
  });
}

export async function listCustomerCalculations(userId: string, page: number, pageSize: number) {
  const where = { createdById: userId };
  const [items, totalItems] = await Promise.all([
    prisma.dutyCalculation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        referenceNumber: true,
        createdAt: true,
        hsCode: true,
        predictedTotalGhs: true,
        totalLandedCostGhs: true,
        confidenceLevel: true,
        inputJson: true,
      },
    }),
    prisma.dutyCalculation.count({ where }),
  ]);
  return { items, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}
