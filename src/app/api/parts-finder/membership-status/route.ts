import { NextResponse } from "next/server";

import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderUserDashboardStats } from "@/lib/parts-finder/dashboard-stats";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getPartsFinderAccessSnapshot();
    if (!access.userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const [pricing, stats] = await Promise.all([
      getPartsFinderActivationSnapshot(),
      getPartsFinderUserDashboardStats(access.userId),
    ]);
    return NextResponse.json({
      ok: true,
      access,
      pricing,
      stats,
      serverTime: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load membership status." }, { status: 500 });
  }
}
