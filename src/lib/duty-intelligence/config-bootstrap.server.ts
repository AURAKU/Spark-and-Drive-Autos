import "server-only";

import type { DutyCountryCode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { dutyCacheInvalidate } from "@/lib/duty-intelligence/cache.server";
import { seedDutyIntelligence } from "../../../prisma/seed-duty-intelligence";

export type DutyConfigHealth = {
  countryConfigExists: boolean;
  ghanaConfigExists: boolean;
  migrationsApplied: boolean;
  formulaRulesCount: number;
  hsCodesCount: number;
  exchangeRatesCount: number;
  shippingCostMatrixCount: number;
  insuranceRulesCount: number;
  chargeTemplatesCount: number;
  isReady: boolean;
  missing: string[];
};

export async function checkDutyConfigHealth(
  countryCode: DutyCountryCode = "GH",
): Promise<DutyConfigHealth> {
  const missing: string[] = [];

  let countryConfigExists = false;
  let ghanaConfigExists = false;
  let formulaRulesCount = 0;
  let hsCodesCount = 0;
  let exchangeRatesCount = 0;
  let shippingCostMatrixCount = 0;
  let insuranceRulesCount = 0;
  let chargeTemplatesCount = 0;
  let migrationsApplied = true;

  try {
    const country = await prisma.dutyCountryConfig.findUnique({
      where: { countryCode },
      include: {
        _count: {
          select: {
            formulaRules: true,
            hsCodes: true,
            exchangeRates: true,
            shippingCostMatrix: true,
            insuranceRules: true,
            chargeTemplates: true,
          },
        },
      },
    });

    countryConfigExists = country != null;
    ghanaConfigExists = countryCode === "GH" && countryConfigExists;

    if (country) {
      formulaRulesCount = country._count.formulaRules;
      hsCodesCount = country._count.hsCodes;
      exchangeRatesCount = country._count.exchangeRates;
      shippingCostMatrixCount = country._count.shippingCostMatrix;
      insuranceRulesCount = country._count.insuranceRules;
      chargeTemplatesCount = country._count.chargeTemplates;
    }
  } catch {
    migrationsApplied = false;
    missing.push("Database migrations may not be applied");
  }

  if (!countryConfigExists) missing.push("Ghana duty country configuration");
  if (formulaRulesCount === 0) missing.push("Tax formula rules");
  if (hsCodesCount === 0) missing.push("HS code library");
  if (exchangeRatesCount === 0) missing.push("Exchange rates");
  if (shippingCostMatrixCount === 0) missing.push("Shipping cost matrix");
  if (insuranceRulesCount === 0) missing.push("Insurance rules");
  if (chargeTemplatesCount === 0) missing.push("Port and agent charge templates");

  const isReady = missing.length === 0;

  return {
    countryConfigExists,
    ghanaConfigExists,
    migrationsApplied,
    formulaRulesCount,
    hsCodesCount,
    exchangeRatesCount,
    shippingCostMatrixCount,
    insuranceRulesCount,
    chargeTemplatesCount,
    isReady,
    missing,
  };
}

/** Idempotently seed Ghana duty configuration. Safe to call multiple times. */
export async function initializeGhanaDutyConfig(): Promise<{ ok: true; countryConfigId: string } | { ok: false; error: string }> {
  try {
    const country = await seedDutyIntelligence(prisma);
    await dutyCacheInvalidate("duty:");
    return { ok: true, countryConfigId: country.id };
  } catch (e) {
    console.error("[initializeGhanaDutyConfig]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Initialization failed" };
  }
}

export const USER_CONFIG_UNAVAILABLE_MESSAGE =
  "Duty configuration is currently unavailable. Please contact the administrator.";

export const ADMIN_CONFIG_INIT_HINT =
  "Ghana duty configuration is being initialized automatically. Retry in a moment or run npm run seed:duty on the server.";
