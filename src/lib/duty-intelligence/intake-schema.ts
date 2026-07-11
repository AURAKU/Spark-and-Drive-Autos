import { z } from "zod";

import { EngineType as EngineTypeEnum } from "@prisma/client";

import {
  dutyCalculationInputSchema,
  dutyPurchaseInputSchema,
  dutyShippingInputSchema,
  dutyVehicleInputSchema,
  EXPORT_COUNTRIES,
  SUPPORTED_CURRENCIES,
} from "./types";

const ICE_FUELS = ["GASOLINE_PETROL", "GASOLINE_DIESEL", "HYBRID", "PLUGIN_HYBRID"] as const;

/** Minimum customer-facing vehicle fields — tax internals excluded. */
export const minimumVehicleIntakeSchema = z
  .object({
    manufacturer: z.string().trim().min(1).max(120),
    model: z.string().trim().min(1).max(120),
    year: z.number().int().min(1980).max(new Date().getFullYear()),
    fuelType: z.nativeEnum(EngineTypeEnum),
    manufactureMonth: z.number().int().min(1).max(12).optional(),
    engineCc: z.number().int().positive().max(30_000).optional(),
    powerKw: z.number().positive().max(2000).optional(),
    vehicleCategory: z.enum(["SUV", "SEDAN", "PICKUP", "TRUCK", "BUS", "VAN"]).optional(),
    countryOfOrigin: z.enum(EXPORT_COUNTRIES).optional(),
    vin: z.string().trim().max(17).optional(),
    seats: z.number().int().positive().max(80).optional(),
    grossWeightKg: z.number().int().positive().max(50_000).optional(),
    confirmedFields: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (ICE_FUELS.includes(data.fuelType as (typeof ICE_FUELS)[number]) && !data.engineCc) {
      ctx.addIssue({
        code: "custom",
        message: "Engine capacity is required for combustion and hybrid vehicles",
        path: ["engineCc"],
      });
    }
    if (data.fuelType === "ELECTRIC" && !data.powerKw && !data.engineCc) {
      ctx.addIssue({
        code: "custom",
        message: "Electric power (kW) helps classify EV duty profiles accurately",
        path: ["powerKw"],
      });
    }
  });

export const minimumIntakeSchema = z.object({
  countryCode: z.literal("GH").default("GH"),
  vehicle: minimumVehicleIntakeSchema,
  purchase: dutyPurchaseInputSchema,
  shipping: dutyShippingInputSchema.partial().optional(),
  carId: z.string().cuid().optional(),
  expertMode: z.boolean().default(false),
  hsCodeOverride: z.string().trim().max(16).optional(),
});

export type MinimumIntakeInput = z.infer<typeof minimumIntakeSchema>;

export function minimumIntakeToCalculationInput(input: MinimumIntakeInput): z.infer<typeof dutyCalculationInputSchema> {
  return dutyCalculationInputSchema.parse({
    countryCode: input.countryCode,
    carId: input.carId,
    hsCodeOverride: input.expertMode ? input.hsCodeOverride : undefined,
    vehicle: {
      manufacturer: input.vehicle.manufacturer,
      model: input.vehicle.model,
      year: input.vehicle.year,
      fuelType: input.vehicle.fuelType,
      engineCc: input.vehicle.engineCc,
      countryOfOrigin: input.vehicle.countryOfOrigin ?? "CHINA",
      vehicleCategory: input.vehicle.vehicleCategory ?? "SUV",
      vin: input.vehicle.vin,
      applyEvDutyWaiver: false,
    },
    purchase: input.purchase,
    shipping: {
      shippingMethod: input.shipping?.shippingMethod ?? "SEA_FREIGHT",
      freightGhsOverride: input.shipping?.freightGhsOverride,
      insuranceGhsOverride: input.shipping?.insuranceGhsOverride,
      otherShippingChargesGhs: input.shipping?.otherShippingChargesGhs ?? 0,
    },
  });
}

export function isIceFuelType(fuelType: string): boolean {
  return (ICE_FUELS as readonly string[]).includes(fuelType);
}

export function isElectricFuelType(fuelType: string): boolean {
  return fuelType === "ELECTRIC";
}
