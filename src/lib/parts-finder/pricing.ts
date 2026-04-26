import { prisma } from "@/lib/prisma";
import type { MembershipAccessSnapshot } from "@/lib/parts-finder/search-types";

export async function getPartsFinderActivationSnapshot() {
  const [total, settings] = await Promise.all([
    prisma.payment.count({
      where: { paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
    }),
    prisma.partsFinderSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return {
    currency: settings?.currencyCode ?? "GHS",
    defaultDurationDays: settings?.activationDurationDays ?? 30,
    activationPriceMinor: settings?.activationPriceMinor ?? 50000,
    renewalPriceMinor: settings?.renewalPriceMinor ?? settings?.activationPriceMinor ?? 50000,
    renewalDurationDays: settings?.renewalDurationDays ?? settings?.activationDurationDays ?? 30,
    successfulActivations: total,
  };
}

export type PartsFinderActivationSnapshot = Awaited<ReturnType<typeof getPartsFinderActivationSnapshot>>;

/**
 * First activation uses activation price + default window; after expiry, renewal price + renewal window.
 */
export function getPartsFinderChargeQuote(
  access: Pick<MembershipAccessSnapshot, "state" | "renewalRequired">,
  pricing: PartsFinderActivationSnapshot,
) {
  const isRenewal = access.renewalRequired || access.state === "EXPIRED";
  return {
    priceMinor: isRenewal ? pricing.renewalPriceMinor : pricing.activationPriceMinor,
    durationDays: isRenewal ? pricing.renewalDurationDays : pricing.defaultDurationDays,
    kind: isRenewal ? ("renewal" as const) : ("activation" as const),
  };
}
