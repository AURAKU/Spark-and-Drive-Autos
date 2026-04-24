import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { requestPartsFinderSourcingForUser } from "@/lib/parts-finder/route-orchestration";

const schema = z.object({
  resultId: z.string().optional(),
  note: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderMembership("RESULTS");
    const input = schema.parse(await request.json());
    await requestPartsFinderSourcingForUser({
      sessionId: input.resultId,
      userId: session.user.id,
      note: input.note,
    });
    return NextResponse.json({ ok: true, message: "Sourcing request logged." });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
