"use server";

import { ensureDutyReportCalculation } from "@/lib/duty-intelligence/report.server";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";

export async function prepareDutyReportAction(
  input: DutyCalculationInput,
  result: DutyIntelligenceResult,
): Promise<{ ok: true; reportUrl: string; referenceNumber: string } | { ok: false; error: string }> {
  const saved = await ensureDutyReportCalculation({ input, result });
  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true, reportUrl: saved.reportUrl, referenceNumber: saved.referenceNumber };
}
