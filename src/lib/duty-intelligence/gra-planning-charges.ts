export type PlanningRateType = "PERCENTAGE" | "FIXED";

type OverlayRule = {
  chargeKey: string;
  chargeName: string;
  rateType: PlanningRateType;
  rateValue?: string;
  flatAmount?: string;
  taxableBaseExpression: string;
  roundingMode: string;
  decimalPlaces: number;
  dependencyOrder: number;
  sourceReference: string;
  verificationStatus: "VERIFIED";
  effectiveFrom: string;
};

export type GraPlanningCharge = {
  chargeKey: string;
  chargeName: string;
  rateType: PlanningRateType;
  /** Percentage as a decimal (0.15 = 15%) or fixed GHS amount. */
  defaultRate: number;
  taxableBaseExpression: string;
  dependencyOrder: number;
  officialNote: string;
};

/**
 * Official Ghana GRA / CET passenger-import descriptors shown on the duty sheet.
 * Defaults match current published levy family. Admin can override any rate.
 * Zero-rate lines stay on the sheet so the catalog is complete when a levy is suspended.
 */
export const GRA_PLANNING_CHARGES: GraPlanningCharge[] = [
  { chargeKey: "IMPORT_DUTY", chargeName: "Import Duty", rateType: "PERCENTAGE", defaultRate: 0.2, taxableBaseExpression: "CUSTOMS_VALUE_GHS", dependencyOrder: 10, officialNote: "ECOWAS CET passenger family — typically 20%. HS-specific Bills of Entry may differ." },
  { chargeKey: "PROCESSING_FEE", chargeName: "Processing Fee", rateType: "FIXED", defaultRate: 0, taxableBaseExpression: "FLAT", dependencyOrder: 11, officialNote: "Customs processing fee. Often GHS 0.00 on current assessments." },
  { chargeKey: "ECOWAS_LEVY", chargeName: "ECOWAS Levy", rateType: "PERCENTAGE", defaultRate: 0.005, taxableBaseExpression: "CIF_GHS", dependencyOrder: 20, officialNote: "0.5% ECOWAS levy on CIF." },
  { chargeKey: "VEHICLE_CERTIFICATION", chargeName: "Vehicle Certification", rateType: "FIXED", defaultRate: 0.5, taxableBaseExpression: "FLAT", dependencyOrder: 21, officialNote: "DVLA / certification stamp — typically GHS 0.50." },
  { chargeKey: "VEHICLE_EXAMINATION_FEE", chargeName: "Vehicle Examination Fee", rateType: "PERCENTAGE", defaultRate: 0.01, taxableBaseExpression: "CUSTOMS_VALUE_GHS", dependencyOrder: 30, officialNote: "1% vehicle examination on customs value." },
  { chargeKey: "NETWORK_CHARGE", chargeName: "Network Charge", rateType: "PERCENTAGE", defaultRate: 0.004, taxableBaseExpression: "FOB_GHS", dependencyOrder: 40, officialNote: "0.4% ICUMS / network charge on FOB." },
  { chargeKey: "NHIL", chargeName: "Import NHIL", rateType: "PERCENTAGE", defaultRate: 0.025, taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", dependencyOrder: 50, officialNote: "2.5% National Health Insurance Levy on CIF + import duty." },
  { chargeKey: "GETFUND_LEVY", chargeName: "GETFund Import Levy", rateType: "PERCENTAGE", defaultRate: 0.025, taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", dependencyOrder: 51, officialNote: "2.5% GETFund levy on CIF + import duty." },
  { chargeKey: "SPECIAL_IMPORT_LEVY", chargeName: "Special Import Levy", rateType: "PERCENTAGE", defaultRate: 0.02, taxableBaseExpression: "CIF_GHS", dependencyOrder: 52, officialNote: "2% Special Import Levy on CIF." },
  { chargeKey: "EXIM_LEVY", chargeName: "EXIM Levy", rateType: "PERCENTAGE", defaultRate: 0.0075, taxableBaseExpression: "CIF_GHS", dependencyOrder: 53, officialNote: "0.75% Ghana EXIM Bank levy on CIF." },
  { chargeKey: "AU_LEVY", chargeName: "African Union Import Levy", rateType: "PERCENTAGE", defaultRate: 0.002, taxableBaseExpression: "CIF_GHS", dependencyOrder: 54, officialNote: "0.2% African Union import levy on CIF." },
  { chargeKey: "WITHHOLDING_TAX_IMPORT", chargeName: "1% Withholding Tax on Import", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "CIF_GHS", dependencyOrder: 55, officialNote: "1% WHT when GRA applies it. Default 0 — enable from admin if required." },
  { chargeKey: "INSPECTION_FEE", chargeName: "Inspection Fee", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "CIF_GHS", dependencyOrder: 56, officialNote: "Inspection / scanning. Default 0 — set the live GRA rate from admin." },
  { chargeKey: "OVERAGE_PENALTY", chargeName: "Overage Penalty", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "CIF_GHS", dependencyOrder: 57, officialNote: "Age-based overage penalty. Default 0 unless GRA applies it to the unit." },
  { chargeKey: "IRS_TAX_DEPOSIT", chargeName: "IRS Tax Deposit", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "CIF_GHS", dependencyOrder: 58, officialNote: "IRS tax deposit. Usually 0.00 for personal vehicle imports." },
  { chargeKey: "COVID_HEALTH_RECOVERY_LEVY", chargeName: "COVID-19 Health Recovery Levy", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", dependencyOrder: 59, officialNote: "Suspended / repealed. Kept at 0 so the descriptor remains on the sheet." },
  { chargeKey: "NETWORK_CHARGE_VAT", chargeName: "Network Charge VAT", rateType: "PERCENTAGE", defaultRate: 0.15, taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", dependencyOrder: 60, officialNote: "15% VAT on the network charge." },
  { chargeKey: "NETWORK_CHARGE_NHIL", chargeName: "Network Charge NHIL", rateType: "PERCENTAGE", defaultRate: 0.025, taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", dependencyOrder: 61, officialNote: "2.5% NHIL on the network charge." },
  { chargeKey: "NETWORK_CHARGE_GETFUND", chargeName: "Network Charge GETFund Levy", rateType: "PERCENTAGE", defaultRate: 0.01, taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", dependencyOrder: 62, officialNote: "GETFund on the network charge (planning default 1%)." },
  { chargeKey: "NETWORK_CHARGE_COVID", chargeName: "Network Charge COVID-19 Health", rateType: "PERCENTAGE", defaultRate: 0, taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", dependencyOrder: 63, officialNote: "Suspended. Kept at 0 for a complete descriptor list." },
  { chargeKey: "IMPORT_VAT", chargeName: "Import VAT", rateType: "PERCENTAGE", defaultRate: 0.15, taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", dependencyOrder: 70, officialNote: "15% Import VAT on CIF + import duty." },
  { chargeKey: "GSA_SNF_FEE", chargeName: "Ghana Shippers Authority SNF Fee", rateType: "FIXED", defaultRate: 9, taxableBaseExpression: "FLAT", dependencyOrder: 80, officialNote: "GSA shipper notification fee. Typical planning amount GHS 9.00." },
  { chargeKey: "DISINFECTION_FEE", chargeName: "GHS Disinfection Fee", rateType: "FIXED", defaultRate: 143.38, taxableBaseExpression: "FLAT", dependencyOrder: 81, officialNote: "Port disinfection. Planning default GHS 143.38 — update from current GRA circular." },
  { chargeKey: "MOTI_EIDF_FEE", chargeName: "MoTI e-IDF Fee", rateType: "FIXED", defaultRate: 5, taxableBaseExpression: "FLAT", dependencyOrder: 82, officialNote: "Ministry of Trade e-IDF — GHS 5.00." },
];

export const GRA_PLANNING_CHARGE_KEYS = GRA_PLANNING_CHARGES.map((c) => c.chargeKey);

export type CalculatorRateOverride = {
  rateType: PlanningRateType;
  rateValue: number;
};

export function defaultCalculatorRates(): Record<string, CalculatorRateOverride> {
  return Object.fromEntries(
    GRA_PLANNING_CHARGES.map((c) => [c.chargeKey, { rateType: c.rateType, rateValue: c.defaultRate }]),
  );
}

export function mergeCalculatorRates(
  stored: Record<string, CalculatorRateOverride> | null | undefined,
): Record<string, CalculatorRateOverride> {
  const merged = defaultCalculatorRates();
  if (!stored || typeof stored !== "object") return merged;
  for (const charge of GRA_PLANNING_CHARGES) {
    const row = stored[charge.chargeKey];
    if (!row) continue;
    const rateValue = Number(row.rateValue);
    if (!Number.isFinite(rateValue) || rateValue < 0) continue;
    merged[charge.chargeKey] = {
      rateType: row.rateType === "FIXED" ? "FIXED" : charge.rateType,
      rateValue,
    };
  }
  return merged;
}

export function planningChargeToRule(
  charge: GraPlanningCharge,
  sourceReference: string,
  override?: CalculatorRateOverride,
): OverlayRule {
  const rateType = override?.rateType ?? charge.rateType;
  const rateValue = override?.rateValue ?? charge.defaultRate;
  return {
    chargeKey: charge.chargeKey,
    chargeName: charge.chargeName,
    rateType,
    rateValue: rateType === "PERCENTAGE" ? String(rateValue) : undefined,
    flatAmount: rateType === "FIXED" ? String(rateValue) : undefined,
    taxableBaseExpression: charge.taxableBaseExpression,
    roundingMode: "HALF_UP",
    decimalPlaces: 2,
    dependencyOrder: charge.dependencyOrder,
    sourceReference,
    verificationStatus: "VERIFIED",
    effectiveFrom: "2024-01-01",
  };
}

export function applyCalculatorRateOverrides<T extends { chargeKey: string; rateType: PlanningRateType; rateValue?: string; flatAmount?: string }>(
  rules: T[],
  overrides?: Record<string, CalculatorRateOverride> | null,
): T[] {
  if (!overrides) return rules;
  return rules.map((rule) => {
    const override = overrides[rule.chargeKey];
    if (!override) return rule;
    const rateValue = Number(override.rateValue);
    if (!Number.isFinite(rateValue) || rateValue < 0) return rule;
    if (override.rateType === "FIXED" || rule.rateType === "FIXED") {
      return { ...rule, rateType: "FIXED", flatAmount: String(rateValue), rateValue: undefined };
    }
    return { ...rule, rateType: "PERCENTAGE", rateValue: String(rateValue), flatAmount: undefined };
  });
}

export function ensureOfficialDescriptors(
  rules: OverlayRule[],
  sourceReference: string,
  overrides?: Record<string, CalculatorRateOverride> | null,
): OverlayRule[] {
  const byKey = new Map(rules.map((r) => [r.chargeKey, r]));
  for (const charge of GRA_PLANNING_CHARGES) {
    if (byKey.has(charge.chargeKey)) continue;
    byKey.set(charge.chargeKey, planningChargeToRule(charge, sourceReference, overrides?.[charge.chargeKey]));
  }
  return applyCalculatorRateOverrides(
    [...byKey.values()].sort((a, b) => a.dependencyOrder - b.dependencyOrder || a.chargeKey.localeCompare(b.chargeKey)),
    overrides,
  );
}
