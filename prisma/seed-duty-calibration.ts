import type { PrismaClient } from "@prisma/client";

import { DEFAULT_CHARGE_NORMALIZATION_DICTIONARY } from "@/lib/duty-assessment/charge-normalization";
import { CALIBRATION_FIXTURES } from "@/lib/duty-assessment/fixtures/calibration-cases";
import { ingestBillOfEntry } from "@/lib/duty-assessment/ingestion";

/**
 * Explicit calibration seed — run only via `npm run seed:duty-calibration`.
 * Never invoked from the main production seed.
 */
export async function seedDutyCalibration(prisma: PrismaClient) {
  if (process.env.SEED_DUTY_CALIBRATION !== "1") {
    throw new Error("Refusing to seed calibration fixtures without SEED_DUTY_CALIBRATION=1");
  }

  const country = await prisma.dutyCountryConfig.findUnique({ where: { countryCode: "GH" } });
  if (!country) {
    throw new Error("Ghana duty country config (GH) must exist before calibration seed.");
  }

  for (const entry of DEFAULT_CHARGE_NORMALIZATION_DICTIONARY) {
    await prisma.dutyChargeNormalization.upsert({
      where: {
        countryConfigId_normalizedChargeKey: {
          countryConfigId: country.id,
          normalizedChargeKey: entry.normalizedChargeKey,
        },
      },
      create: {
        countryConfigId: country.id,
        normalizedChargeKey: entry.normalizedChargeKey,
        displayName: entry.displayName,
        category: entry.category,
        aliases: entry.aliases,
        externalTaxCodes: entry.externalTaxCodes ?? undefined,
        notes: entry.notes,
        active: true,
      },
      update: {
        displayName: entry.displayName,
        category: entry.category,
        aliases: entry.aliases,
        externalTaxCodes: entry.externalTaxCodes ?? undefined,
        notes: entry.notes,
        active: true,
      },
    });
  }

  const results = [];
  for (const fixture of CALIBRATION_FIXTURES) {
    const result = await ingestBillOfEntry(prisma, {
      ...fixture,
      countryConfigId: country.id,
    });
    results.push({ billOfEntryNumber: fixture.billOfEntryNumber, ...result });
  }

  return { countryConfigId: country.id, assessments: results };
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const out = await seedDutyCalibration(prisma);
    console.info("[seed-duty-calibration] complete:", JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-duty-calibration] failed:", err);
  process.exit(1);
});
