import { prisma } from "@/lib/prisma";

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
