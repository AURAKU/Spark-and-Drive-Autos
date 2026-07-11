import { z } from "zod";

export const dutyAdminSettingsSchema = z.object({
  publicCalculatorEnabled: z.boolean().default(true),
  calculatorModes: z.array(z.enum(["STANDARD", "EXPERT"])).default(["STANDARD"]),
  confidenceWording: z.string().default("Estimates are for planning only — final assessment by Ghana Customs."),
  disclaimer: z.string().default("Not a final Ghana Customs or ICUMS assessment."),
  defaultEstimateBandPct: z.number().min(0).max(50).default(10),
  staleFxThresholdDays: z.number().int().min(1).max(90).default(7),
  minimumCalibrationSampleSize: z.number().int().min(1).max(1000).default(3),
  maxPublicRequestsPerHour: z.number().int().min(1).max(10_000).default(60),
  manualReviewTriggers: z.array(z.string()).default(["HIGH_VALUE", "UNVERIFIED_HS", "LOW_CONFIDENCE"]),
  highValueThresholdGhs: z.number().positive().default(500_000),
  supportedCurrencies: z.array(z.string()).default(["USD", "CNY", "EUR", "GBP", "GHS"]),
  supportedPorts: z.array(z.string()).default(["Tema", "Takoradi"]),
});

export type DutyAdminSettings = z.infer<typeof dutyAdminSettingsSchema>;

export const DEFAULT_DUTY_ADMIN_SETTINGS: DutyAdminSettings = dutyAdminSettingsSchema.parse({});

export function parseDutyAdminSettings(raw: unknown): DutyAdminSettings {
  const parsed = dutyAdminSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_DUTY_ADMIN_SETTINGS;
}

export function mergeDutyAdminSettings(current: unknown, patch: Partial<DutyAdminSettings>): DutyAdminSettings {
  return dutyAdminSettingsSchema.parse({
    ...parseDutyAdminSettings(current),
    ...patch,
  });
}
