import { z } from "zod";

export const fxRateInputSchema = z.object({
  fromCurrency: z.string().trim().length(3).toUpperCase(),
  toCurrency: z.string().trim().length(3).toUpperCase().default("GHS"),
  rate: z.coerce.number().positive(),
  effectiveDate: z.coerce.date(),
  source: z.enum(["BANK_OF_GHANA", "CUSTOMS", "MANUAL_OVERRIDE", "GLOBAL_CURRENCY"]),
  isOverride: z.coerce.boolean().default(false),
  overrideReason: z.string().trim().max(500).optional(),
});

export type FxRateInput = z.infer<typeof fxRateInputSchema>;

export function isFxRateStale(effectiveDate: Date, thresholdDays: number, now = new Date()): boolean {
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return now.getTime() - effectiveDate.getTime() > thresholdMs;
}

export function validateFxRateInput(input: unknown): { ok: true; data: FxRateInput } | { ok: false; error: string } {
  const parsed = fxRateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid FX rate input." };
  if (parsed.data.isOverride && !parsed.data.overrideReason?.trim()) {
    return { ok: false, error: "Manual override requires a reason." };
  }
  return { ok: true, data: parsed.data };
}
