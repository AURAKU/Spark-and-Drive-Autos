import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { checkPartsFinderRateLimit } from "@/lib/parts-finder/rate-limit";
import { submitPartsFinderSearch } from "@/lib/parts-finder/route-orchestration";
import { partsFinderInputSchema } from "@/lib/parts-finder/schemas";

export async function POST(request: Request) {
  try {
    const { session, snapshot } = await requirePartsFinderMembership("SEARCH");
    const limit = checkPartsFinderRateLimit({
      key: `parts-finder:search:${session.user.id}`,
      maxRequests: 12,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many search requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
    const payload = partsFinderInputSchema.parse(await request.json());
    const queued = submitPartsFinderSearch(payload, session.user.id, snapshot);
    return NextResponse.json({
      ok: true,
      job: {
        jobId: queued.jobId,
        state: queued.state,
        cached: queued.cached,
        sessionId: queued.sessionId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Search failed." }, { status: 400 });
  }
}
