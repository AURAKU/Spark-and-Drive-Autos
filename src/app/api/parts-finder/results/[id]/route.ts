import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { getUserSafePartsFinderSessionResult } from "@/lib/parts-finder/route-orchestration";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await requirePartsFinderMembership("RESULTS");
    const { id } = await context.params;
    const row = await getUserSafePartsFinderSessionResult(id, session.user.id);
    if (!row) {
      return NextResponse.json({ ok: false, error: "Result not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Result not found." }, { status: 400 });
  }
}
