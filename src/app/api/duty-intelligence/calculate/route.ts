import { NextResponse } from "next/server";

import {
  ADMIN_CONFIG_INIT_HINT,
  USER_CONFIG_UNAVAILABLE_MESSAGE,
} from "@/lib/duty-intelligence/config-bootstrap";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { isPipelineError, runDutyIntelligencePipeline } from "@/lib/duty-intelligence/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = dutyCalculationInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: firstError, details: parsed.error.flatten() }, { status: 400 });
    }

    const start = Date.now();
    const result = await runDutyIntelligencePipeline(parsed.data);
    const elapsed = Date.now() - start;

    if (isPipelineError(result)) {
      return NextResponse.json(
        {
          error: result.code,
          message: result.message,
          adminHint: result.adminHint ?? ADMIN_CONFIG_INIT_HINT,
          health: result.health,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ result, meta: { elapsedMs: elapsed } });
  } catch (error) {
    console.error("[duty-intelligence/calculate]", error);
    return NextResponse.json(
      { error: "CALCULATION_FAILED", message: USER_CONFIG_UNAVAILABLE_MESSAGE },
      { status: 500 },
    );
  }
}
