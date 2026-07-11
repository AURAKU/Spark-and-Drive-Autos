import { EngineType } from "@prisma/client";
import { z } from "zod";

export const dutyEstimateInputSchema = z
  .object({
    cifGhs: z.number().positive().max(500_000_000),
    vehicleYear: z.number().int().min(1980).max(new Date().getFullYear() + 1),
    engineCc: z.number().int().positive().max(30_000).optional(),
    powertrain: z.nativeEnum(EngineType).default(EngineType.GASOLINE_PETROL),
    applyEvDutyWaiver: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.applyEvDutyWaiver && data.powertrain !== "ELECTRIC") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duty relief scenario applies to electric (BEV) only.",
        path: ["applyEvDutyWaiver"],
      });
    }
  });

export type DutyEstimateInput = z.infer<typeof dutyEstimateInputSchema>;
