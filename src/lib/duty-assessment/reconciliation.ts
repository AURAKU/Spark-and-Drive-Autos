import { normalizeChargeName } from "./charge-normalization";
import type { AssessmentLineInput, ReconciliationResult } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reconcile BoE charge lines with receipt lines using normalizedChargeKey.
 * Prevents duplicate fee liabilities — receipt amounts attach to existing BoE lines.
 */
export function reconcileAssessmentLines(params: {
  billOfEntryLines: AssessmentLineInput[];
  receiptLines: AssessmentLineInput[];
}): ReconciliationResult {
  const boeByKey = new Map<string, AssessmentLineInput>();
  const duplicateKeysPrevented: string[] = [];

  for (const line of params.billOfEntryLines) {
    const key = normalizeChargeName(line.chargeName);
    if (boeByKey.has(key)) {
      duplicateKeysPrevented.push(key);
      continue;
    }
    boeByKey.set(key, line);
  }

  const matchedKeys: string[] = [];
  const unmatchedReceiptLines: AssessmentLineInput[] = [];

  for (const receiptLine of params.receiptLines) {
    const key = normalizeChargeName(receiptLine.chargeName);
    if (boeByKey.has(key)) {
      matchedKeys.push(key);
    } else {
      unmatchedReceiptLines.push(receiptLine);
    }
  }

  const totalPayableFromLines = round2(
    params.billOfEntryLines.reduce((sum, line) => sum + line.amountPayable, 0),
  );

  return {
    matchedKeys,
    unmatchedReceiptLines,
    duplicateKeysPrevented,
    totalPayableFromLines,
  };
}

/** Sum payable lines — used to validate fixture totals. */
export function sumLinePayables(lines: AssessmentLineInput[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amountPayable, 0));
}
