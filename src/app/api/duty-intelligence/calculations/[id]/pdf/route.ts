import { NextResponse } from "next/server";

import { buildDutyEstimatePdf } from "@/lib/duty-intelligence/pdf";
import { getCustomerCalculation } from "@/lib/duty-intelligence/customer-save";
import { getPublicCalculatorAccess } from "@/lib/duty-intelligence/public-access";
import { emitDutyEvent } from "@/lib/duty-intelligence/observability/events";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { safeAuth } from "@/lib/safe-auth";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(req: Request, ctx: { params: Params }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await getCustomerCalculation(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const access = await getPublicCalculatorAccess();
  const pdf = await buildDutyEstimatePdf({
    referenceNumber: row.referenceNumber,
    customerName: session.user.name ?? undefined,
    input: row.inputJson as DutyCalculationInput,
    result: row.resultJson as DutyIntelligenceResult,
    disclaimer: access.disclaimer,
  });

  emitDutyEvent({
    event: "pdf_generated",
    calculationId: id,
    userId: session.user.id,
    referenceNumber: row.referenceNumber,
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sda-duty-estimate-${row.referenceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
