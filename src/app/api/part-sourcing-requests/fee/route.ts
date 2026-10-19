import { NextResponse } from "next/server";

import { getPartsRequestFeeSettings } from "@/lib/parts-request-fee";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getPartsRequestFeeSettings();
  return NextResponse.json({
    enabled: settings.enabled,
    feeGhs: Number(settings.feeAmount),
    currency: settings.currency,
  });
}
