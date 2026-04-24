import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { logPartsFinderResultConversionForUser } from "@/lib/parts-finder/route-orchestration";

const schema = z.object({
  resultId: z.string().min(1),
  conversionType: z.enum(["OPEN_CHAT", "REQUEST_QUOTE"]),
});

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderMembership("RESULTS");
    const input = schema.parse(await request.json());
    await logPartsFinderResultConversionForUser({
      sessionId: input.resultId,
      userId: session.user.id,
      conversionType: input.conversionType,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Conversion action failed." }, { status: 400 });
  }
}
