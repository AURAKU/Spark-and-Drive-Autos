import { z } from "zod";

export const partsFinderInputSchema = z
  .object({
    vin: z.string().trim().max(32).optional(),
    chassis: z.string().trim().max(32).optional(),
    brand: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    year: z.union([z.string(), z.number()]).optional(),
    engine: z.string().trim().max(120).optional(),
    trim: z.string().trim().max(120).optional(),
    partDescription: z.string().trim().max(500).optional(),
    partImage: z
      .object({
        fileName: z.string().trim().max(160).optional(),
        mimeType: z.string().trim().max(80).optional(),
        sizeBytes: z.number().int().min(1).max(8_000_000).optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    const hasIdentifier = Boolean(val.vin?.trim() || val.chassis?.trim());
    const hasVehicleTriplet = Boolean(val.brand?.trim() && val.model?.trim() && val.year != null);
    const hasPart = Boolean(val.partDescription?.trim());
    if (!hasIdentifier && !(hasVehicleTriplet && hasPart)) {
      ctx.addIssue({
        code: "custom",
        path: ["partDescription"],
        message: "Provide VIN/chassis or brand+model+year with part description.",
      });
    }
  });

export const partsFinderReviewOverrideSchema = z.object({
  sessionId: z.string().min(1),
  resultId: z.string().trim().min(1).optional(),
  decision: z.enum(["APPROVED", "REJECTED", "LOW_CONFIDENCE", "VERIFIED", "LIKELY", "FLAGGED_SOURCING"]),
  adminNote: z.string().trim().max(1000).optional(),
  forcedSummary: z.string().trim().max(1500).optional(),
  correctedPartName: z.string().trim().max(240).optional(),
  correctedOemCodes: z.array(z.string().trim().min(1).max(80)).max(15).optional(),
});

export const partsFinderMembershipAdminSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
  days: z.number().int().min(1).max(365).optional(),
});

export const partsFinderSettingsSchema = z.object({
  activationPriceMinor: z.number().int().min(100).max(100000000),
  activationDurationDays: z.number().int().min(1).max(365),
  approvalMode: z.enum(["AUTO", "MANUAL"]),
  featureEnabled: z.boolean(),
  requireManualReviewBelow: z.number().int().min(1).max(99),
});

export type PartsFinderInput = z.infer<typeof partsFinderInputSchema>;
