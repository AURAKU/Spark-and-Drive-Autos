import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderAdmin } from "@/lib/parts-finder/access";
import { getPartsFinderAnalytics } from "@/lib/parts-finder/intelligence-analytics";

export async function GET() {
  try {
    await requirePartsFinderAdmin();
    const analytics = await getPartsFinderAnalytics();
    return NextResponse.json({ ok: true, analytics });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load analytics." },
      { status: 400 },
    );
  }
}
