/** Pure valuation helpers — FOB, freight, insurance, and CIF stay distinct. */

export type PricingBasis = "FOB" | "CFR" | "CIF" | "EXW" | "DDP" | "UNKNOWN";

export type ValuationChain = {
  pricingBasis: PricingBasis;
  fobGhs: number;
  freightGhs: number;
  insuranceGhs: number;
  otherGhs: number;
  cifGhs: number;
  customsValueGhs: number;
  /** True when CIF was admin/customer override (freight/insurance not added into CIF). */
  cifOverridden: boolean;
  /** True when FOB was back-solved from CIF − freight − insurance. */
  fobInferredFromCif: boolean;
  notes: string[];
};

export function roundGhs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function resolvePricingBasis(params: {
  declared?: PricingBasis | null;
  cifGhsOverride?: number | null;
}): PricingBasis {
  if (params.declared && params.declared !== "UNKNOWN") return params.declared;
  if (params.cifGhsOverride != null && params.cifGhsOverride > 0) return "CIF";
  return "FOB";
}

/**
 * Build FOB / freight / insurance / CIF without collapsing freight into FOB.
 *
 * - FOB basis: CIF = FOB + Freight + Insurance + Other
 * - CIF basis (override): customs value = override; FOB back-solved when purchase FOB missing/ambiguous
 * - CFR basis: CIF = (FOB + Freight) + Insurance + Other
 */
export function buildValuationChain(params: {
  pricingBasis: PricingBasis;
  purchaseFobGhs: number;
  freightGhs: number;
  /** Insurance for the FOB+freight base (or overridden flat amount). */
  insuranceGhs: number;
  otherGhs?: number;
  cifGhsOverride?: number | null;
}): ValuationChain {
  const otherGhs = roundGhs(params.otherGhs ?? 0);
  const freightGhs = roundGhs(params.freightGhs);
  const notes: string[] = [];
  const override =
    params.cifGhsOverride != null && Number.isFinite(params.cifGhsOverride) && params.cifGhsOverride > 0
      ? roundGhs(params.cifGhsOverride)
      : null;

  if (params.pricingBasis === "CIF" || override != null) {
    const cifGhs = override ?? roundGhs(params.purchaseFobGhs);
    // Prefer an explicit purchase FOB when it is distinct from CIF; otherwise back-solve.
    const purchaseLooksLikeCif =
      Math.abs(roundGhs(params.purchaseFobGhs) - cifGhs) < 0.02 || params.purchaseFobGhs <= 0;
    let fobGhs: number;
    let fobInferredFromCif = false;
    const insuranceGhs = roundGhs(params.insuranceGhs);

    if (!purchaseLooksLikeCif) {
      fobGhs = roundGhs(params.purchaseFobGhs);
      notes.push("CIF override with separate purchase FOB — freight/insurance kept distinct.");
    } else {
      // First pass: if insurance already resolved from (unknown FOB), back-solve FOB = CIF − freight − insurance.
      fobGhs = roundGhs(Math.max(0, cifGhs - freightGhs - insuranceGhs - otherGhs));
      fobInferredFromCif = true;
      notes.push("CIF declared — FOB inferred as CIF − Freight − Insurance (not treated as including freight).");
    }

    return {
      pricingBasis: "CIF",
      fobGhs,
      freightGhs,
      insuranceGhs,
      otherGhs,
      cifGhs,
      customsValueGhs: cifGhs,
      cifOverridden: true,
      fobInferredFromCif,
      notes,
    };
  }

  const fobGhs = roundGhs(params.purchaseFobGhs);
  const insuranceGhs = roundGhs(params.insuranceGhs);

  if (params.pricingBasis === "CFR") {
    const cifGhs = roundGhs(fobGhs + freightGhs + insuranceGhs + otherGhs);
    notes.push("CFR basis — freight included with purchase; insurance still resolved separately.");
    return {
      pricingBasis: "CFR",
      fobGhs,
      freightGhs,
      insuranceGhs,
      otherGhs,
      cifGhs,
      customsValueGhs: cifGhs,
      cifOverridden: false,
      fobInferredFromCif: false,
      notes,
    };
  }

  const cifGhs = roundGhs(fobGhs + freightGhs + insuranceGhs + otherGhs);
  notes.push("FOB basis — CIF = FOB + Freight + Insurance.");
  return {
    pricingBasis: params.pricingBasis === "UNKNOWN" ? "FOB" : params.pricingBasis,
    fobGhs,
    freightGhs,
    insuranceGhs,
    otherGhs,
    cifGhs,
    customsValueGhs: cifGhs,
    cifOverridden: false,
    fobInferredFromCif: false,
    notes,
  };
}

export function computeLandedCostGhs(params: {
  customsValueGhs: number;
  totalEstimatedDutyPayableGhs: number;
  extraPostCustomsGhs?: number;
}): number {
  return roundGhs(
    params.customsValueGhs + params.totalEstimatedDutyPayableGhs + (params.extraPostCustomsGhs ?? 0),
  );
}
