import { NextResponse } from "next/server";

import { checkDutyConfigHealth, USER_CONFIG_UNAVAILABLE_MESSAGE } from "@/lib/duty-intelligence/config-bootstrap";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { getDutyAnalytics } from "@/lib/duty-intelligence/analytics";
import { requireAdmin } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const config = await loadCountryConfigSafe("GH");
    if (!config) {
      return NextResponse.json(
        {
          error: "CONFIG_UNAVAILABLE",
          message: USER_CONFIG_UNAVAILABLE_MESSAGE,
          health: await checkDutyConfigHealth("GH"),
          analytics: null,
        },
        { status: 503 },
      );
    }
    const analytics = await getDutyAnalytics(config.countryConfigId);
    return NextResponse.json({ analytics });
  } catch (error) {
    return NextResponse.json(
      { error: "Analytics unavailable", message: USER_CONFIG_UNAVAILABLE_MESSAGE },
      { status: 500 },
    );
  }
}
