import { normalizeChargeName } from "@/lib/duty-assessment/charge-normalization";

import type { OverrideAuditSnapshot } from "./audit";
import { buildDependencyGraph } from "./dependency-graph";
import { engineError, isEngineError } from "./errors";
import { money, moneySum, moneyToNumber, type Money } from "./money";
import { reconcileTotals, roundMoney } from "./rounding";
import type { VersionedRuleSet, EngineRuleDefinition } from "./rule-sets/verified-profiles";
import { evaluateTaxableBase, type ValueContext } from "./taxable-base-expression";

export type CalculationEngineInput = {
  assessmentDate: Date;
  ruleSet: VersionedRuleSet;
  fobGhs: string | number;
  freightGhs: string | number;
  insuranceGhs: string | number;
  customsValueGhs?: string | number;
  cifGhs?: string | number;
  depreciatedCustomsValueGhs?: string | number;
  adminOverrides?: Record<string, string | number>;
  overrideAudit?: OverrideAuditSnapshot;
  documentedTotalGhs?: string | number;
};

export type CalculatedChargeLine = {
  chargeKey: string;
  chargeName: string;
  normalizedChargeKey: string;
  amountGhs: number;
  taxableBaseGhs: number;
  rate: string | null;
  formula: string;
  taxableBaseExpression: string;
  sourceReference: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  category: "DUTY" | "LEVY" | "VAT" | "FEE";
  displayOrder: number;
};

export type CalculationEngineResult = {
  ruleSetId: string;
  ruleSetVersion: string;
  profileId: string;
  valueContext: {
    fobGhs: number;
    freightGhs: number;
    insuranceGhs: number;
    cifGhs: number;
    customsValueGhs: number;
  };
  lines: CalculatedChargeLine[];
  totalDutyPayableGhs: number;
  reconciliation: ReturnType<typeof reconcileTotals> | null;
  formulaSnapshot: VersionedRuleSet;
  lineSnapshots: CalculatedChargeLine[];
  overrideAudit: OverrideAuditSnapshot | null;
};

function categorizeCharge(chargeKey: string): CalculatedChargeLine["category"] {
  if (chargeKey === "IMPORT_DUTY") return "DUTY";
  if (chargeKey.includes("VAT")) return "VAT";
  if (chargeKey.includes("FEE") || chargeKey === "NETWORK_CHARGE") return "FEE";
  return "LEVY";
}

function computeLineAmount(rule: EngineRuleDefinition, base: Money): Money {
  if (rule.rateType === "FIXED") {
    return money(rule.flatAmount ?? "0");
  }
  if (rule.rateType === "PERCENTAGE") {
    return base.times(rule.rateValue ?? "0");
  }
  throw new Error(`Unsupported rate type for ${rule.chargeKey}`);
}

export function runCalculationEngine(input: CalculationEngineInput): CalculationEngineResult {
  const fobGhs = money(input.fobGhs);
  const freightGhs = money(input.freightGhs);
  const insuranceGhs = money(input.insuranceGhs);
  const cifGhs = input.cifGhs != null ? money(input.cifGhs) : fobGhs.plus(freightGhs).plus(insuranceGhs);
  const customsValueGhs = input.customsValueGhs != null ? money(input.customsValueGhs) : cifGhs;

  if (customsValueGhs.lte(0)) {
    throw engineError("MISSING_CUSTOMS_VALUE", "Customs value must be greater than zero");
  }

  const adminOverrides = new Map<string, Money>(
    Object.entries(input.adminOverrides ?? {}).map(([k, v]) => [k, money(v)]),
  );

  const ctx: ValueContext = {
    fobGhs,
    freightGhs,
    insuranceGhs,
    cifGhs,
    customsValueGhs,
    depreciatedCustomsValueGhs: input.depreciatedCustomsValueGhs != null ? money(input.depreciatedCustomsValueGhs) : undefined,
    lineAmounts: new Map(),
    adminOverrides,
    assessedExternalBases: new Map(),
  };

  let graph;
  try {
    graph = buildDependencyGraph(
      input.ruleSet.rules.map((r) => ({
        chargeKey: r.chargeKey,
        dependencyOrder: r.dependencyOrder,
        taxableBaseExpression: r.taxableBaseExpression,
      })),
    );
  } catch (error) {
    if (isEngineError(error)) throw error;
    throw engineError("RULE_DEPENDENCY_ERROR", error instanceof Error ? error.message : "Dependency graph failed");
  }

  const lines: CalculatedChargeLine[] = [];
  const seenKeys = new Set<string>();
  let previousLineKey: string | undefined;

  for (const node of graph.ordered) {
    const rule = input.ruleSet.rules.find((r) => r.chargeKey === node.chargeKey);
    if (!rule) continue;

    if (seenKeys.has(rule.chargeKey)) {
      throw engineError("RULE_DEPENDENCY_ERROR", `Duplicate charge key ${rule.chargeKey} in rule set`);
    }
    seenKeys.add(rule.chargeKey);

    let taxableBase: Money;
    try {
      taxableBase = evaluateTaxableBase(rule.taxableBaseExpression, ctx, {
        chargeKey: rule.chargeKey,
        previousLineKey,
      });
    } catch (error) {
      throw engineError("RULE_DEPENDENCY_ERROR", error instanceof Error ? error.message : "Missing dependency", {
        details: { chargeKey: rule.chargeKey, expression: rule.taxableBaseExpression },
      });
    }

    const rawAmount = computeLineAmount(rule, taxableBase);
    const rounded = roundMoney(rawAmount, rule.decimalPlaces, rule.roundingMode);

    if (rule.skipWhenZero && rounded.isZero()) {
      previousLineKey = rule.chargeKey;
      continue;
    }

    ctx.lineAmounts.set(rule.chargeKey, rounded);

    const amountNumber = moneyToNumber(rounded, rule.decimalPlaces);
    const baseNumber = moneyToNumber(taxableBase, 2);

    lines.push({
      chargeKey: rule.chargeKey,
      chargeName: rule.chargeName,
      normalizedChargeKey: normalizeChargeName(rule.chargeName),
      amountGhs: amountNumber,
      taxableBaseGhs: baseNumber,
      rate: rule.rateType === "PERCENTAGE" ? rule.rateValue ?? null : null,
      formula:
        rule.rateType === "PERCENTAGE"
          ? `${baseNumber.toLocaleString("en-GH")} × ${(Number(rule.rateValue) * 100).toFixed(2)}% = ${amountNumber}`
          : `Fixed GHS ${rule.flatAmount}`,
      taxableBaseExpression: rule.taxableBaseExpression,
      sourceReference: rule.sourceReference,
      verificationStatus: rule.verificationStatus,
      category: categorizeCharge(rule.chargeKey),
      displayOrder: rule.dependencyOrder,
    });

    previousLineKey = rule.chargeKey;
  }

  const totalDutyPayable = moneySum(lines.map((l) => money(l.amountGhs)));
  const totalNumber = moneyToNumber(totalDutyPayable, 2);

  let reconciliation = null;
  if (input.documentedTotalGhs != null) {
    reconciliation = reconcileTotals({
      calculatedLineTotal: totalDutyPayable,
      documentedTotal: money(input.documentedTotalGhs),
    });
  }

  return {
    ruleSetId: input.ruleSet.id,
    ruleSetVersion: input.ruleSet.version,
    profileId: input.ruleSet.profileId,
    valueContext: {
      fobGhs: moneyToNumber(fobGhs),
      freightGhs: moneyToNumber(freightGhs),
      insuranceGhs: moneyToNumber(insuranceGhs),
      cifGhs: moneyToNumber(cifGhs),
      customsValueGhs: moneyToNumber(customsValueGhs),
    },
    lines,
    totalDutyPayableGhs: totalNumber,
    reconciliation,
    formulaSnapshot: input.ruleSet,
    lineSnapshots: lines,
    overrideAudit: input.overrideAudit ?? null,
  };
}
