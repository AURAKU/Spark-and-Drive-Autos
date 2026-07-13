import { NextResponse } from "next/server";

import { checkDutyConfigHealth, USER_CONFIG_UNAVAILABLE_MESSAGE } from "@/lib/duty-intelligence/config-bootstrap.server";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const health = await checkDutyConfigHealth("GH");
  return NextResponse.json({ health });
}

export async function POST() {
  const { initializeGhanaDutyConfig } = await import("@/lib/duty-intelligence/config-bootstrap.server");
  const result = await initializeGhanaDutyConfig();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  const health = await checkDutyConfigHealth("GH");
  return NextResponse.json({ ok: true, health });
}
