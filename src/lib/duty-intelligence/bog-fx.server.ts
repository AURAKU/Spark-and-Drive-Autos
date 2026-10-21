import "server-only";

import { DutyExchangeRateSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { dutyCacheInvalidate } from "@/lib/duty-intelligence/cache.server";
import { fetchBankOfGhanaFx, type BogFxSnapshot } from "@/lib/duty-intelligence/bog-fx";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";

export type DutyFxQuote = {
  rate: number;
  source: string;
  effectiveDate: string;
  fromCurrency: string;
};

function startOfUtcDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export async function getPreferredDutyFx(params: {
  countryConfigId: string;
  fromCurrency: string;
  toCurrency?: string;
}): Promise<DutyFxQuote | null> {
  const toCurrency = (params.toCurrency ?? "GHS").toUpperCase();
  const fromCurrency = params.fromCurrency.toUpperCase();
  const rows = await prisma.dutyExchangeRate.findMany({
    where: { countryConfigId: params.countryConfigId, fromCurrency, toCurrency },
    orderBy: { effectiveDate: "desc" },
    take: 12,
  });
  if (rows.length === 0) return null;

  const override = rows.find((r) => r.isOverride || r.source === DutyExchangeRateSource.MANUAL_OVERRIDE);
  const bog = rows.find((r) => r.source === DutyExchangeRateSource.BANK_OF_GHANA);
  const pick =
    override && (!bog || override.effectiveDate >= bog.effectiveDate)
      ? override
      : (bog ?? rows[0]!);

  return {
    rate: Number(pick.rate),
    source: pick.source,
    effectiveDate: pick.effectiveDate.toISOString(),
    fromCurrency,
  };
}

export async function persistBogSnapshot(params: {
  countryConfigId: string;
  snapshot: BogFxSnapshot;
}): Promise<{ written: number; skipped: boolean; reason?: string }> {
  const day = startOfUtcDay(params.snapshot.rateDate);
  const existingOverride = await prisma.dutyExchangeRate.findFirst({
    where: {
      countryConfigId: params.countryConfigId,
      fromCurrency: "USD",
      toCurrency: "GHS",
      isOverride: true,
      effectiveDate: { gte: day },
    },
    orderBy: { effectiveDate: "desc" },
  });
  if (existingOverride) {
    return { written: 0, skipped: true, reason: "admin_override_holds_today" };
  }

  let written = 0;
  for (const pair of params.snapshot.pairs) {
    const already = await prisma.dutyExchangeRate.findFirst({
      where: {
        countryConfigId: params.countryConfigId,
        fromCurrency: pair.fromCurrency,
        toCurrency: "GHS",
        source: DutyExchangeRateSource.BANK_OF_GHANA,
        effectiveDate: day,
      },
    });
    if (already) continue;
    await prisma.dutyExchangeRate.create({
      data: {
        countryConfigId: params.countryConfigId,
        fromCurrency: pair.fromCurrency,
        toCurrency: "GHS",
        rate: pair.mid,
        source: DutyExchangeRateSource.BANK_OF_GHANA,
        effectiveDate: day,
        isOverride: false,
      },
    });
    written += 1;
  }

  if (written > 0) await dutyCacheInvalidate("duty:");
  return { written, skipped: false };
}

export async function refreshBankOfGhanaDutyRates(): Promise<{
  ok: boolean;
  snapshot?: BogFxSnapshot;
  written: number;
  skipped?: boolean;
  reason?: string;
}> {
  const config = await loadCountryConfigSafe("GH");
  if (!config) return { ok: false, written: 0, reason: "duty_config_unavailable" };
  const snapshot = await fetchBankOfGhanaFx();
  const persist = await persistBogSnapshot({ countryConfigId: config.countryConfigId, snapshot });
  return { ok: true, snapshot, written: persist.written, skipped: persist.skipped, reason: persist.reason };
}

let lastRefreshAttempt = 0;

export function scheduleBankOfGhanaFxRefresh(): void {
  const now = Date.now();
  if (now - lastRefreshAttempt < 6 * 60 * 60 * 1000) return;
  lastRefreshAttempt = now;
  void refreshBankOfGhanaDutyRates().catch((e) => {
    console.warn("[duty-fx] Bank of Ghana refresh failed:", e instanceof Error ? e.message : e);
  });
}
