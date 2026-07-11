"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveSessionOrRedirect, requireAdmin } from "@/lib/auth-helpers";
import { saveCustomerDutyEstimate, listCustomerCalculations, getCustomerCalculation } from "@/lib/duty-intelligence/customer-save";
import { buildDutyEstimatePdf } from "@/lib/duty-intelligence/pdf";
import { isPipelineError, runDutyIntelligencePipeline, saveDutyCalculation } from "@/lib/duty-intelligence/pipeline";
import { emitDutyEvent } from "@/lib/duty-intelligence/observability/events";
import { dutyCalculationInputSchema, type DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { getPublicCalculatorAccess } from "@/lib/duty-intelligence/public-access";
import { safeAuth } from "@/lib/safe-auth";

export type DutyCalculatorActionState = { ok?: boolean; error?: string; id?: string; referenceNumber?: string };

export async function saveDutyEstimateAction(
  input: z.infer<typeof dutyCalculationInputSchema>,
  result: DutyIntelligenceResult,
): Promise<DutyCalculatorActionState> {
  const session = await safeAuth();
  if (!session?.user?.id) return { error: "Sign in to save estimates." };

  const parsed = dutyCalculationInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid estimate input." };

  try {
    const saved = await saveCustomerDutyEstimate({
      input: parsed.data,
      result,
      userId: session.user.id,
    });
    revalidatePath("/dashboard/duty");
    revalidatePath("/dashboard/duty/history");
    return { ok: true, id: saved.id, referenceNumber: saved.referenceNumber };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save estimate." };
  }
}

export async function adminSaveDutyEstimateAction(
  input: z.infer<typeof dutyCalculationInputSchema>,
  result: DutyIntelligenceResult,
): Promise<DutyCalculatorActionState> {
  const admin = await requireAdmin();
  const parsed = dutyCalculationInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid estimate input." };

  const saved = await saveDutyCalculation({
    input: parsed.data,
    result,
    createdById: admin.user.id,
    status: "SAVED",
  });
  emitDutyEvent({
    event: "estimate_saved",
    referenceNumber: saved.referenceNumber,
    calculationId: saved.id,
    userId: admin.user.id,
  });
  revalidatePath("/admin/duty/calculations");
  return { ok: true, id: saved.id, referenceNumber: saved.referenceNumber };
}

export async function getCustomerDutyHistory(page = 1, pageSize = 20) {
  const session = await requireActiveSessionOrRedirect("/dashboard/duty/history");
  return listCustomerCalculations(session.user.id, page, pageSize);
}

export async function getCustomerDutyDetail(calculationId: string) {
  const session = await requireActiveSessionOrRedirect("/dashboard/duty");
  const row = await getCustomerCalculation(calculationId, session.user.id);
  if (!row) return null;
  return row;
}

export async function getPublicCalculatorConfig() {
  return getPublicCalculatorAccess("GH");
}

export async function generateDutyEstimatePdfAction(calculationId: string): Promise<{ ok: boolean; error?: string; pdfBase64?: string }> {
  const session = await safeAuth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const row = await getCustomerCalculation(calculationId, session.user.id);
  if (!row) return { ok: false, error: "Estimate not found." };

  const input = row.inputJson as z.infer<typeof dutyCalculationInputSchema>;
  const result = row.resultJson as DutyIntelligenceResult;
  const access = await getPublicCalculatorAccess();

  const pdf = await buildDutyEstimatePdf({
    referenceNumber: row.referenceNumber,
    customerName: session.user.name ?? undefined,
    input,
    result,
    disclaimer: access.disclaimer,
  });

  emitDutyEvent({ event: "pdf_generated", calculationId, userId: session.user.id, referenceNumber: row.referenceNumber });

  return { ok: true, pdfBase64: Buffer.from(pdf).toString("base64") };
}

export async function recalculateDutyAction(input: z.infer<typeof dutyCalculationInputSchema>) {
  const access = await getPublicCalculatorAccess();
  if (!access.enabled) return { error: access.disclaimer || "Calculator unavailable." };

  const parsed = dutyCalculationInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const result = await runDutyIntelligencePipeline(parsed.data);
  if (isPipelineError(result)) return { error: result.message, code: result.code };
  return { result };
}
