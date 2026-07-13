import { NextResponse } from "next/server";

import {
  ADMIN_CONFIG_INIT_HINT,
  USER_CONFIG_UNAVAILABLE_MESSAGE,
  checkDutyConfigHealth,
} from "@/lib/duty-intelligence/config-bootstrap.server";
import { loadCountryConfigSafe, getLatestExchangeRate } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "USD").toUpperCase();
  const countryCode = (searchParams.get("country") ?? "GH") as "GH";

  const config = await loadCountryConfigSafe(countryCode);
  if (!config) {
    const health = await checkDutyConfigHealth(countryCode);
    return NextResponse.json(
      {
        error: "CONFIG_UNAVAILABLE",
        message: USER_CONFIG_UNAVAILABLE_MESSAGE,
        adminHint: ADMIN_CONFIG_INIT_HINT,
        health,
      },
      { status: 503 },
    );
  }

  const rate = await getLatestExchangeRate({
    countryConfigId: config.countryConfigId,
    fromCurrency: from,
  });

  const history = await prisma.dutyExchangeRate.findMany({
    where: { countryConfigId: config.countryConfigId, fromCurrency: from },
    orderBy: { effectiveDate: "desc" },
    take: 30,
    select: { rate: true, source: true, effectiveDate: true, isOverride: true },
  });

  return NextResponse.json({
    current: rate,
    history: history.map((h) => ({
      rate: Number(h.rate),
      source: h.source,
      effectiveDate: h.effectiveDate.toISOString(),
      isOverride: h.isOverride,
    })),
  });
}
