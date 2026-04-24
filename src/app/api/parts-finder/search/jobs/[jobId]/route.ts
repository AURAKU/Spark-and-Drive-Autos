import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { checkPartsFinderRateLimit } from "@/lib/parts-finder/rate-limit";
import { getPartsFinderSearchJobForUser } from "@/lib/parts-finder/route-orchestration";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { session } = await requirePartsFinderMembership("SEARCH");
    const { jobId } = await context.params;
    if (!z.string().uuid().safeParse(jobId).success) {
      return NextResponse.json({ ok: false, error: "Invalid job id." }, { status: 400 });
    }
    const limit = checkPartsFinderRateLimit({
      key: `parts-finder:poll:${session.user.id}`,
      maxRequests: 90,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many polling requests. Slow down and retry shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
    const row = getPartsFinderSearchJobForUser(jobId, session.user.id);
    if (!row) return NextResponse.json({ ok: true, status: "NOT_FOUND" });
    return NextResponse.json({
      ok: true,
      status: row.state,
      job: {
        jobId: row.id,
        sessionId: row.sessionId ?? null,
        error: row.error ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Job lookup failed." }, { status: 400 });
  }
}
