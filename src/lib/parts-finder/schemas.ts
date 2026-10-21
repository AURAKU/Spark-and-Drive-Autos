import { z } from "zod";

export const PARTS_FINDER_INPUT_HINT =
  "Enter an OEM/part number, a VIN or chassis, or brand + model + year with the part you need.";

/** Toyota-style 45503-60050, Hyundai 58101-2S000, Bosch-like F026T03123. */
export function looksLikeOemPartNumber(raw: string | undefined): boolean {
  const text = (raw ?? "").trim().toUpperCase();
  if (!text) return false;
  return text.split(/[\s,;/]+/).some((token) => {
    if (!/^[A-Z0-9][A-Z0-9-]{4,22}[A-Z0-9]$/.test(token)) return false;
    const compact = token.replace(/-/g, "");
    return compact.length >= 6 && compact.length <= 24 && /\d/.test(compact);
  });
}

export function describePartsFinderInputGap(val: {
  vin?: string;
  chassis?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  partDescription?: string;
}): string | null {
  const hasIdentifier = Boolean(val.vin?.trim() || val.chassis?.trim());
  const yearText = val.year == null ? "" : String(val.year).trim();
  const hasVehicleTriplet = Boolean(val.brand?.trim() && val.model?.trim() && yearText);
  const hasPart = Boolean(val.partDescription?.trim());
  const hasOem = looksLikeOemPartNumber(val.partDescription);
  if (hasIdentifier || hasOem || (hasVehicleTriplet && hasPart)) return null;
  return PARTS_FINDER_INPUT_HINT;
}

export const partsFinderInputSchema = z
  .object({
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be 17 characters and use valid VIN format.")
      .optional(),
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
    const message = describePartsFinderInputGap(val);
    if (!message) return;
    ctx.addIssue({
      code: "custom",
      path: ["partDescription"],
      message,
    });
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
