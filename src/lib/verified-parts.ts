import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getVerifiedPartSettings() {
  const settings = await prisma.verifiedPartRequestSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (settings) return settings;
  return prisma.verifiedPartRequestSettings.create({
    data: {
      enabled: true,
      feeAmount: new Prisma.Decimal(50),
      currency: "GHS",
      serviceDescription:
        "Verified Part Request helps our team confirm exact fitment using VIN/chassis, catalog checks, and supplier confirmation before sourcing.",
      legalNote:
        "Verified based on VIN/chassis and supplier confirmation where available.",
    },
  });
}

export async function nextVerifiedPartRequestNumber(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const dayEnd = new Date(`${now.toISOString().slice(0, 10)}T23:59:59.999Z`);
  const count = await prisma.verifiedPartRequest.count({
    where: { createdAt: { gte: dayStart, lte: dayEnd } },
  });
  return `SDA-VPR-${ymd}-${String(count + 1).padStart(4, "0")}`;
}
