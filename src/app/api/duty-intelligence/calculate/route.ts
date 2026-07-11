import { NextResponse } from "next/server";

import {
  ADMIN_CONFIG_INIT_HINT,
  USER_CONFIG_UNAVAILABLE_MESSAGE,
} from "@/lib/duty-intelligence/config-bootstrap";
import { emitDutyEvent } from "@/lib/duty-intelligence/observability/events";
import { assertPublicCalculatorEnabled, getPublicCalculatorAccess } from "@/lib/duty-intelligence/public-access";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { isPipelineError, runDutyIntelligencePipeline } from "@/lib/duty-intelligence/pipeline";
import { rateLimitDutyCalculation } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: Request) {
  try {
    const gate = await assertPublicCalculatorEnabled("GH");
    if (!gate.ok) {
      return NextResponse.json({ error: "CALCULATOR_DISABLED", message: gate.message }, { status: 503 });
    }

    const access = await getPublicCalculatorAccess("GH");
    const ip = clientIp(req);
    const limited = await rateLimitDutyCalculation(ip, access.maxRequestsPerHour);
    if (!limited.success) {
      return NextResponse.json({ error: "RATE_LIMITED", message: "Too many calculations. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = dutyCalculationInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: firstError, details: parsed.error.flatten() }, { status: 400 });
    }

    emitDutyEvent({
      event: "calculation_started",
      profileId: parsed.data.hsCodeOverride,
      carId: parsed.data.carId,
    });

    const start = Date.now();
    const result = await runDutyIntelligencePipeline(parsed.data);
    const elapsed = Date.now() - start;

    if (isPipelineError(result)) {
      emitDutyEvent({
        event: "calculation_failed",
        errorCode: result.code,
        elapsedMs: elapsed,
      });
      if (result.code === "NEEDS_CLASSIFICATION" || result.code === "MISSING_CLASSIFICATION") {
        emitDutyEvent({ event: "classification_uncertain", errorCode: result.code, elapsedMs: elapsed });
      }
      if (result.code === "ADMIN_REVIEW_REQUIRED") {
        emitDutyEvent({ event: "admin_review_requested", errorCode: result.code, elapsedMs: elapsed });
      }

      const status =
        result.code === "CONFIG_UNAVAILABLE"
          ? 503
          : result.code === "NEEDS_CLASSIFICATION" || result.code === "MISSING_CLASSIFICATION"
            ? 422
            : 400;
      return NextResponse.json(
        {
          error: result.code,
          message: result.message,
          adminHint: result.adminHint ?? ADMIN_CONFIG_INIT_HINT,
          health: result.health,
          missingFields: result.missingFields,
          details: result.details,
        },
        { status },
      );
    }

    emitDutyEvent({
      event: "calculation_completed",
      elapsedMs: elapsed,
      profileId: result.profileId,
      ruleSetVersion: result.ruleSetVersion,
      confidenceLevel: result.confidence.level,
      cacheHit: Boolean(result.cacheFingerprint),
    });

    return NextResponse.json({ result, meta: { elapsedMs: elapsed } });
  } catch (error) {
    console.error("[duty-intelligence/calculate]", error);
    emitDutyEvent({ event: "calculation_failed", errorCode: "INTERNAL" });
    return NextResponse.json(
      { error: "CALCULATION_FAILED", message: USER_CONFIG_UNAVAILABLE_MESSAGE },
      { status: 500 },
    );
  }
}
