import { NextResponse } from "next/server";

import { assertProfileLegalCompleteOrResponse } from "@/lib/legal-compliance-central";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { checkPartsFinderRateLimit } from "@/lib/parts-finder/rate-limit";
import { submitPartsFinderSearch } from "@/lib/parts-finder/route-orchestration";
import { partsFinderInputSchema } from "@/lib/parts-finder/schemas";

export async function POST(request: Request) {
  try {
    const { session, snapshot } = await requirePartsFinderMembership("SEARCH");
    const legalBlock = await assertProfileLegalCompleteOrResponse(session.user.id);
    if (legalBlock) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please accept legal requirements on your Profile before running search.",
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          policyKey: POLICY_KEYS.PLATFORM_TERMS_PRIVACY,
        },
        { status: 409 },
      );
    }
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
    const queued = await submitPartsFinderSearch(payload, session.user.id, snapshot);
    return NextResponse.json({
      ok: true,
      job: {
        jobId: queued.jobId,
        state: queued.state === "COMPLETED" ? "COMPLETE" : "PROCESSING",
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
    console.error("[parts-finder] search submit failed", error);
    return NextResponse.json({ ok: false, error: "We could not complete this search. Please try again." }, { status: 400 });
  }
}
