"use server";

import { ensureDutyReportCalculation } from "@/lib/duty-intelligence/report.server";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";

export async function prepareDutyReportAction(
  input: DutyCalculationInput,
  result: DutyIntelligenceResult,
): Promise<
  | { ok: true; reportUrl: string; exportUrl: string; referenceNumber: string }
  | { ok: false; error: string }
> {
  const saved = await ensureDutyReportCalculation({ input, result });
  if (!saved.ok) return { ok: false, error: saved.error };
  const exportUrl = `/duty-report/${saved.id}/export?access=${encodeURIComponent(saved.accessToken)}`;
  return { ok: true, reportUrl: saved.reportUrl, exportUrl, referenceNumber: saved.referenceNumber };
}
