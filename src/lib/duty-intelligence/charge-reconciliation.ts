/** Normalize / dedupe payable duty lines and reconcile against the displayed total. */

import type { CalculationLineItem } from "@/lib/duty-intelligence/types";

const VALUATION_OR_INFO = new Set(["FOB", "FREIGHT", "INSURANCE", "CIF", "CUSTOMS", "TOTAL", "EXCHANGE_RATE"]);

const ALIAS_TO_CANONICAL: Record<string, string> = {
  IMPORTDUTY: "IMPORT_DUTY",
  CUSTOMSDUTY: "IMPORT_DUTY",
  DUTY: "IMPORT_DUTY",
  IMPORTVAT: "IMPORT_VAT",
  VAT: "IMPORT_VAT",
  IMPORTNHIL: "IMPORT_NHIL",
  NHIL: "IMPORT_NHIL",
  GETFUNDLEVY: "GETFUND_LEVY",
  GETFUND: "GETFUND_LEVY",
  ECOWAS: "ECOWAS_LEVY",
  ECOWASLEVY: "ECOWAS_LEVY",
  SIL: "SPECIAL_IMPORT_LEVY",
  SPECIALIMPORTLEVY: "SPECIAL_IMPORT_LEVY",
  EXIM: "EXIM_LEVY",
  EXIMLEVY: "EXIM_LEVY",
  AU: "AFRICAN_UNION_LEVY",
  AULEVY: "AFRICAN_UNION_LEVY",
  AFRICANUNIONLEVY: "AFRICAN_UNION_LEVY",
  NETWORKCHARGE: "NETWORK_CHARGE",
  NETWORKCHARGEVAT: "NETWORK_CHARGE_VAT",
  NETWORKCHARGENHIL: "NETWORK_CHARGE_NHIL",
  NETWORKCHARGEGETFUND: "NETWORK_CHARGE_GETFUND",
  VEHICLEEXAMINATIONFEE: "VEHICLE_EXAMINATION_FEE",
  INSPECTIONFEE: "INSPECTION_FEE",
  WITHHOLDINGTAX: "WITHHOLDING_TAX",
  DISINFECTIONFEE: "DISINFECTION_FEE",
  EIDFFEE: "E_IDF_FEE",
  SHIPPERSAUTHORITYFEE: "SHIPPERS_AUTHORITY_FEE",
};

export function roundMoney2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeChargeKey(code: string | null | undefined, label?: string | null): string {
  const raw = (code || label || "").trim().toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]+/g, "");
  if (ALIAS_TO_CANONICAL[compact]) return ALIAS_TO_CANONICAL[compact];
  if (raw.includes("_")) return raw.replace(/\s+/g, "_");
  return compact || "UNKNOWN_CHARGE";
}

export type PayableDutyLine = {
  code: string;
  label: string;
  category: CalculationLineItem["category"];
  amountGhs: number;
  basis: string;
  formula: string;
  rate?: number;
  rateType?: string;
  source: CalculationLineItem["source"];
};

export type DutyLineReconciliation = {
  payableLines: PayableDutyLine[];
  lineItemSumGhs: number;
  totalEstimatedDutyPayableGhs: number;
  reconciliationDifferenceGhs: number;
  withinTolerance: boolean;
  duplicateKeysDropped: string[];
};

const TOLERANCE_GHS = 0.02;

/**
 * Keep unique payable charges only (no valuation rows, no grouped aliases).
 * Total Estimated Duty Payable MUST equal the sum of these lines.
 */
export function reconcilePayableDutyLines(
  items: CalculationLineItem[] | null | undefined,
  opts?: { expectedTotalGhs?: number | null; toleranceGhs?: number },
): DutyLineReconciliation {
  const tolerance = opts?.toleranceGhs ?? TOLERANCE_GHS;
  const seen = new Set<string>();
  const duplicateKeysDropped: string[] = [];
  const payableLines: PayableDutyLine[] = [];

  for (const item of items ?? []) {
    if (!item || typeof item !== "object") continue;
    if (VALUATION_OR_INFO.has(item.category) || VALUATION_OR_INFO.has(String(item.code || "").toUpperCase())) {
      continue;
    }
    // Only payable tax/levy/fee/port/agent/shipping categories.
    if (!["DUTY", "LEVY", "VAT", "FEE", "PORT", "SHIPPING_LINE", "AGENT"].includes(item.category)) {
      continue;
    }
    const key = normalizeChargeKey(item.code, item.label);
    if (seen.has(key)) {
      duplicateKeysDropped.push(key);
      continue;
    }
    seen.add(key);
    const amountGhs = roundMoney2(Number(item.amountGhs));
    if (!Number.isFinite(amountGhs)) continue;
    payableLines.push({
      code: key,
      label: (item.label || key).trim(),
      category: item.category,
      amountGhs,
      basis: item.basis || "—",
      formula: item.formula || "—",
      rate: item.rate,
      rateType: item.rateType,
      source: item.source,
    });
  }

  const lineItemSumGhs = roundMoney2(payableLines.reduce((s, l) => s + l.amountGhs, 0));
  // Authoritative total is always the unique line sum.
  const totalEstimatedDutyPayableGhs = lineItemSumGhs;
  // When expected omitted, difference vs self is 0. When provided, check engine vs lines.
  const vsEngine =
    opts?.expectedTotalGhs != null
      ? roundMoney2(Math.abs(lineItemSumGhs - roundMoney2(opts.expectedTotalGhs)))
      : 0;

  return {
    payableLines,
    lineItemSumGhs,
    totalEstimatedDutyPayableGhs,
    reconciliationDifferenceGhs: vsEngine,
    withinTolerance: vsEngine <= tolerance,
    duplicateKeysDropped,
  };
}
