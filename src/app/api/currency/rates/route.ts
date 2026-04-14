import { NextResponse } from "next/server";

import { getExchangeRateSummary, getGlobalCurrencySettings } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * Public read-only snapshot of global FX (for integrations, debugging, or future client-side converters).
 */
export async function GET() {
  const s = await getGlobalCurrencySettings();
  const summary = getExchangeRateSummary(s);
  return NextResponse.json({
    currencies: ["CNY", "GHS", "USD"] as const,
    canonicalBase: "CNY",
    rates: summary,
    updatedAt: s.updatedAt.toISOString(),
  });
}
