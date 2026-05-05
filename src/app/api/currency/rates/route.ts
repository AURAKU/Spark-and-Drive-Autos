import { NextResponse } from "next/server";

import { getExchangeRateSummary, getGlobalCurrencySettings } from "@/lib/currency";
import { safeDateToIso } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read-only snapshot of global FX (for integrations, debugging, or future client-side converters).
 */
export async function GET() {
  try {
    const s = await getGlobalCurrencySettings();
    const summary = getExchangeRateSummary(s);
    return NextResponse.json({
      currencies: ["CNY", "GHS", "USD"] as const,
      canonicalBase: "CNY",
      rates: summary,
      updatedAt: safeDateToIso(s.updatedAt),
    });
  } catch (e) {
    console.error("[currency/rates] failed", e);
    return NextResponse.json({ error: "currency_unavailable" }, { status: 503 });
  }
}
