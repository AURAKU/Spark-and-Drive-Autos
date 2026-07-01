import { NextResponse } from "next/server";

import { USER_CONFIG_UNAVAILABLE_MESSAGE, checkDutyConfigHealth } from "@/lib/duty-intelligence/config-bootstrap";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";

export const runtime = "nodejs";

export async function GET() {
  const config = await loadCountryConfigSafe("GH");
  if (!config) {
    return NextResponse.json(
      { error: "CONFIG_UNAVAILABLE", message: USER_CONFIG_UNAVAILABLE_MESSAGE, health: await checkDutyConfigHealth("GH") },
      { status: 503 },
    );
  }
  return NextResponse.json({
    formulaRules: config.formulaRules.map((r) => ({
      code: r.code,
      label: r.label,
      basis: r.basis,
      rateType: r.rateType,
      rateValue: r.rateValue,
      version: r.version,
    })),
  });
}
