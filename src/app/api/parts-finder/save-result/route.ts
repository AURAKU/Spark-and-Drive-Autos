import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { saveTopPartsFinderResultForUser } from "@/lib/parts-finder/route-orchestration";

const schema = z.object({
  resultId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderMembership("RESULTS");
    const input = schema.parse(await request.json());
    await saveTopPartsFinderResultForUser(input.resultId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save result." }, { status: 400 });
  }
}
