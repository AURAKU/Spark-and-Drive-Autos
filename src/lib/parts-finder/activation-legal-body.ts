import { z } from "zod";

/** Shared POST body for Paystack and wallet Parts Finder activation. */
export const partsFinderActivateBodySchema = z.object({
  platformTermsAccepted: z.literal(true),
  partsFinderDisclaimerAccepted: z.literal(true),
  platformTermsVersion: z.string().min(1).max(40),
  partsFinderDisclaimerVersion: z.string().min(1).max(40),
});

export type PartsFinderActivateBody = z.infer<typeof partsFinderActivateBodySchema>;
