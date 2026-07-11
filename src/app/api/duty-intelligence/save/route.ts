import { NextResponse } from "next/server";
import { z } from "zod";

import { saveCustomerDutyEstimate } from "@/lib/duty-intelligence/customer-save";
import { assertPublicCalculatorEnabled } from "@/lib/duty-intelligence/public-access";
import { dutyCalculationInputSchema, type DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { safeAuth } from "@/lib/safe-auth";
import { rateLimitForm } from "@/lib/rate-limit";

export const runtime = "nodejs";

const saveSchema = z.object({
  input: dutyCalculationInputSchema,
  result: z.custom<DutyIntelligenceResult>(),
});

export async function POST(req: Request) {
  const gate = await assertPublicCalculatorEnabled("GH");
  if (!gate.ok) {
    return NextResponse.json({ error: "CALCULATOR_DISABLED", message: gate.message }, { status: 503 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Sign in to save estimates." }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? session.user.id;
  const limited = await rateLimitForm(ip);
  if (!limited.success) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid save payload." }, { status: 400 });
  }

  const saved = await saveCustomerDutyEstimate({
    input: parsed.data.input,
    result: parsed.data.result,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true, id: saved.id, referenceNumber: saved.referenceNumber });
}
