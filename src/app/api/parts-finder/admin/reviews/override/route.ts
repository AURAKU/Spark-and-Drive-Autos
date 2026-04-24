import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderAdmin } from "@/lib/parts-finder/access";
import { applyPartsFinderReviewOverride } from "@/lib/parts-finder/persistence";
import { partsFinderReviewOverrideSchema } from "@/lib/parts-finder/schemas";

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderAdmin();
    const contentType = request.headers.get("content-type") ?? "";
    const rawValue =
      contentType.includes("application/json")
        ? await request.json()
        : Object.fromEntries((await request.formData()).entries());
    const raw = rawValue as Record<string, unknown>;
    const correctedOemCodes =
      typeof raw.correctedOemCodes === "string"
        ? raw.correctedOemCodes
            .split(",")
            .map((code) => code.trim())
            .filter(Boolean)
        : Array.isArray(raw.correctedOemCodes)
          ? raw.correctedOemCodes.map((code) => String(code).trim()).filter(Boolean)
          : undefined;
    const input = partsFinderReviewOverrideSchema.parse({
      ...raw,
      correctedOemCodes,
    });
    await applyPartsFinderReviewOverride({
      sessionId: input.sessionId,
      reviewerId: session.user.id,
      decision: input.decision,
      adminNote: input.adminNote,
      forcedSummary: input.forcedSummary,
      resultId: input.resultId,
      correctedPartName: input.correctedPartName,
      correctedOemCodes,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Review override failed." }, { status: 400 });
  }
}
