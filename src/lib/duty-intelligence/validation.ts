import { z } from "zod";

import { engineError } from "./errors";

export const engineValueInputSchema = z.object({
  fobGhs: z.number().nonnegative(),
  freightGhs: z.number().nonnegative(),
  insuranceGhs: z.number().nonnegative(),
  customsValueGhs: z.number().positive().optional(),
  cifGhs: z.number().positive().optional(),
  depreciatedCustomsValueGhs: z.number().positive().optional(),
  fxRate: z.number().positive().optional(),
});

export const engineClassificationSchema = z.object({
  hsCode: z.string().trim().min(4).max(16).optional(),
  hsCodeOverride: z.string().trim().min(4).max(16).optional(),
  fuelType: z.string().trim().min(2),
  engineCc: z.number().int().positive().optional(),
  powerKw: z.number().positive().optional(),
  vehicleCategory: z.string().optional(),
  manufactureYear: z.number().int().min(1980),
  make: z.string().optional(),
  model: z.string().optional(),
});

export const engineCalculationRequestSchema = z.object({
  assessmentDate: z.coerce.date(),
  values: engineValueInputSchema,
  classification: engineClassificationSchema,
  documentedTotalGhs: z.number().nonnegative().optional(),
  adminOverrides: z.record(z.string(), z.number()).optional(),
});

export type EngineCalculationRequest = z.infer<typeof engineCalculationRequestSchema>;

export function validateEngineRequest(input: unknown): EngineCalculationRequest {
  const parsed = engineCalculationRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw engineError("VALIDATION_ERROR", "Invalid calculation request", {
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}
