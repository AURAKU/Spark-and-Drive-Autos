import { NextResponse } from "next/server";

import { loadCountryConfig, getLatestExchangeRate } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "USD").toUpperCase();
  const countryCode = (searchParams.get("country") ?? "GH") as "GH";

  try {
    const config = await loadCountryConfig(countryCode);
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load rates" },
      { status: 500 },
    );
  }
}
