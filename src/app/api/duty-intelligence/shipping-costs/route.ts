import { NextResponse } from "next/server";

import { USER_CONFIG_UNAVAILABLE_MESSAGE, checkDutyConfigHealth } from "@/lib/duty-intelligence/config-bootstrap.server";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin")?.toUpperCase();

  const config = await loadCountryConfigSafe("GH");
  if (!config) {
    return NextResponse.json(
      { error: "CONFIG_UNAVAILABLE", message: USER_CONFIG_UNAVAILABLE_MESSAGE, health: await checkDutyConfigHealth("GH") },
      { status: 503 },
    );
  }

  const rows = await prisma.dutyShippingCostMatrix.findMany({
    where: {
      countryConfigId: config.countryConfigId,
      active: true,
      ...(origin ? { originCountry: origin as never } : {}),
    },
    orderBy: [{ originCountry: "asc" }, { shippingMethod: "asc" }],
  });

  return NextResponse.json({
    shippingCosts: rows.map((r) => ({
      id: r.id,
      originCountry: r.originCountry,
      vehicleCategory: r.vehicleCategory,
      shippingMethod: r.shippingMethod,
      containerType: r.containerType,
      freightGhs: Number(r.freightGhs),
      transitDays: r.transitDays,
    })),
  });
}
