import { prisma } from "@/lib/prisma";

import { dutyCacheInvalidate } from "./cache";

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Compare estimated vs actual duty on verified import completion.
 * Updates calibration factors without overwriting historical records.
 */
export async function recalibrateFromVerifiedImport(verifiedImportId: string): Promise<void> {
  const row = await prisma.dutyVerifiedImport.findUnique({
    where: { id: verifiedImportId },
  });
  if (!row || row.status !== "VERIFIED") return;

  const estimated = row.estimatedDutyGhs != null ? Number(row.estimatedDutyGhs) : null;
  const actual = row.totalDutyGhs != null ? Number(row.totalDutyGhs) : null;
  if (estimated == null || actual == null || estimated <= 0) return;

  const errorPct = round4(((actual - estimated) / estimated) * 100);
  await prisma.dutyVerifiedImport.update({
    where: { id: verifiedImportId },
    data: { predictionErrorPct: errorPct },
  });

  const factor = round4(actual / estimated);
  const categories = ["IMPORT_DUTY", "VAT", "PORT", "SHIPPING_LINE", "AGENT"] as const;

  for (const category of categories) {
    const existing = await prisma.dutyCalibrationFactor.findUnique({
      where: {
        countryConfigId_category: {
          countryConfigId: row.countryConfigId,
          category,
        },
      },
    });

    if (existing) {
      const prevFactor = Number(existing.factor);
      const prevCount = existing.sampleCount;
      const newCount = prevCount + 1;
      const blended = round4((prevFactor * prevCount + factor) / newCount);
      const prevAvg = existing.avgErrorPct != null ? Number(existing.avgErrorPct) : 0;
      const newAvg = round4((prevAvg * prevCount + errorPct) / newCount);

      await prisma.dutyCalibrationFactor.update({
        where: { id: existing.id },
        data: {
          factor: blended,
          sampleCount: newCount,
          avgErrorPct: newAvg,
          lastCalibratedAt: new Date(),
        },
      });
    } else {
      await prisma.dutyCalibrationFactor.create({
        data: {
          countryConfigId: row.countryConfigId,
          category,
          factor,
          sampleCount: 1,
          avgErrorPct: errorPct,
        },
      });
    }
  }

  await dutyCacheInvalidate("duty:config");
}
