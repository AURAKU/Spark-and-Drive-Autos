import { NextResponse } from "next/server";

import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { runDutyIntelligencePipeline } from "@/lib/duty-intelligence/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = dutyCalculationInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const start = Date.now();
    const result = await runDutyIntelligencePipeline(parsed.data);
    const elapsed = Date.now() - start;

    return NextResponse.json({ result, meta: { elapsedMs: elapsed } });
  } catch (error) {
    console.error("[duty-intelligence/calculate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Calculation failed" },
      { status: 500 },
    );
  }
}
