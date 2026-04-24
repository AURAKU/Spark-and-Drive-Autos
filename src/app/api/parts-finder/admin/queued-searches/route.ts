import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderAdmin } from "@/lib/parts-finder/access";
import { listQueuedPartsFinderReviews } from "@/lib/parts-finder/persistence";

export async function GET() {
  try {
    await requirePartsFinderAdmin();
    const rows = await listQueuedPartsFinderReviews(200);
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load queue." }, { status: 400 });
  }
}
