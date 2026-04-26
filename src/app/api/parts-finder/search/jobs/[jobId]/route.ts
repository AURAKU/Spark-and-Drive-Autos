import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { checkPartsFinderRateLimit } from "@/lib/parts-finder/rate-limit";
import { getPartsFinderSearchJobForUser } from "@/lib/parts-finder/route-orchestration";

function mapPublicStatus(state: string): "PROCESSING" | "COMPLETE" | "FAILED" | "TIMEOUT" {
  if (state === "COMPLETED") return "COMPLETE";
  if (state === "RUNNING" || state === "QUEUED") return "PROCESSING";
  if (state === "TIMEOUT") return "TIMEOUT";
  if (state === "FAILED") return "FAILED";
  return "PROCESSING";
}

function toSafeMessage(state: "COMPLETE" | "FAILED" | "TIMEOUT", rawError: string | undefined) {
  if (state === "TIMEOUT" || rawError === "SEARCH_TIMEOUT") {
    return "This search took too long. Please try again.";
  }
  if (state === "FAILED") {
    return "We could not complete this search. Please try again.";
  }
  return undefined;
}

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
    const row = await getPartsFinderSearchJobForUser(jobId, session.user.id);
    if (!row) return NextResponse.json({ ok: true, status: "NOT_FOUND" });
    const publicStatus = mapPublicStatus(row.state);
    const completedAt =
      publicStatus === "COMPLETE" || publicStatus === "FAILED" || publicStatus === "TIMEOUT"
        ? new Date(row.updatedAt).toISOString()
        : null;
    const errorMessage =
      publicStatus === "FAILED" || publicStatus === "TIMEOUT"
        ? (toSafeMessage(publicStatus, row.error) ?? null)
        : null;
    return NextResponse.json({
      ok: true,
      id: row.id,
      status: publicStatus,
      result:
        publicStatus === "COMPLETE" && row.sessionId
          ? { sessionId: row.sessionId }
          : null,
      errorMessage,
      createdAt: new Date(row.createdAt).toISOString(),
      completedAt,
      job: {
        jobId: row.id,
        sessionId: row.sessionId ?? null,
        error: errorMessage,
      },
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    console.error("[parts-finder][jobs] status lookup failed", error);
    return NextResponse.json({ ok: false, error: "Job lookup failed." }, { status: 400 });
  }
}
