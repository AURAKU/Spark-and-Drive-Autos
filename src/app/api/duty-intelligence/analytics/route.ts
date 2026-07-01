import { NextResponse } from "next/server";

import { loadCountryConfig } from "@/lib/duty-intelligence/config-loader";
import { getDutyAnalytics } from "@/lib/duty-intelligence/analytics";
import { requireAdmin } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const config = await loadCountryConfig("GH");
    const analytics = await getDutyAnalytics(config.countryConfigId);
    return NextResponse.json({ analytics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics failed" },
      { status: 500 },
    );
  }
}
