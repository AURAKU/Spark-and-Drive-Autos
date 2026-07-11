import type { Money } from "./money";
import { moneySum, moneyZero } from "./money";

export type ValueContext = {
  fobGhs: Money;
  freightGhs: Money;
  insuranceGhs: Money;
  cifGhs: Money;
  customsValueGhs: Money;
  depreciatedCustomsValueGhs?: Money;
  lineAmounts: Map<string, Money>;
  adminOverrides: Map<string, Money>;
  assessedExternalBases: Map<string, Money>;
};

export type ParsedExpression =
  | { kind: "ATOM"; key: string }
  | { kind: "SELECTED_LINE"; chargeKey: string }
  | { kind: "SUM_OF_LINES"; chargeKeys: string[] }
  | { kind: "CUSTOMS_VALUE_PLUS_SELECTED_LINES"; chargeKeys: string[] };

const ATOM_KEYS = new Set([
  "FOB_GHS",
  "FREIGHT_GHS",
  "INSURANCE_GHS",
  "CIF_GHS",
  "CUSTOMS_VALUE_GHS",
  "DEPRECIATED_CUSTOMS_VALUE",
  "CIF_PLUS_IMPORT_DUTY",
  "FLAT",
  "ADMIN_OVERRIDE",
  "ASSESSED_EXTERNAL_BASE",
  "PREVIOUS_LINE",
]);

export function parseTaxableBaseExpression(expression: string): ParsedExpression {
  const trimmed = expression.trim();

  if (trimmed.startsWith("SELECTED_LINE:")) {
    return { kind: "SELECTED_LINE", chargeKey: trimmed.slice("SELECTED_LINE:".length).trim() };
  }

  if (trimmed.startsWith("SUM_OF_LINES:")) {
    const chargeKeys = trimmed
      .slice("SUM_OF_LINES:".length)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return { kind: "SUM_OF_LINES", chargeKeys };
  }

  if (trimmed.startsWith("CUSTOMS_VALUE_PLUS_SELECTED_LINES:")) {
    const chargeKeys = trimmed
      .slice("CUSTOMS_VALUE_PLUS_SELECTED_LINES:".length)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return { kind: "CUSTOMS_VALUE_PLUS_SELECTED_LINES", chargeKeys };
  }

  if (!ATOM_KEYS.has(trimmed)) {
    throw new Error(`Unsupported taxable base expression: ${expression}`);
  }

  return { kind: "ATOM", key: trimmed };
}

export function evaluateTaxableBase(
  expression: string,
  ctx: ValueContext,
  opts?: { chargeKey?: string; previousLineKey?: string },
): Money {
  const parsed = parseTaxableBaseExpression(expression);

  if (parsed.kind === "SELECTED_LINE") {
    const amount = ctx.lineAmounts.get(parsed.chargeKey);
    if (amount == null) {
      throw new Error(`Missing dependency line ${parsed.chargeKey} for expression ${expression}`);
    }
    return amount;
  }

  if (parsed.kind === "SUM_OF_LINES") {
    const amounts = parsed.chargeKeys.map((key) => {
      const value = ctx.lineAmounts.get(key);
      if (value == null) throw new Error(`Missing line ${key} for SUM_OF_LINES`);
      return value;
    });
    return moneySum(amounts);
  }

  if (parsed.kind === "CUSTOMS_VALUE_PLUS_SELECTED_LINES") {
    const selected = parsed.chargeKeys.map((key) => {
      const value = ctx.lineAmounts.get(key);
      if (value == null) throw new Error(`Missing line ${key} for CUSTOMS_VALUE_PLUS_SELECTED_LINES`);
      return value;
    });
    return ctx.customsValueGhs.plus(moneySum(selected));
  }

  switch (parsed.key) {
    case "FOB_GHS":
      return ctx.fobGhs;
    case "FREIGHT_GHS":
      return ctx.freightGhs;
    case "INSURANCE_GHS":
      return ctx.insuranceGhs;
    case "CIF_GHS":
      return ctx.cifGhs;
    case "CUSTOMS_VALUE_GHS":
      return ctx.customsValueGhs;
    case "DEPRECIATED_CUSTOMS_VALUE":
      return ctx.depreciatedCustomsValueGhs ?? ctx.customsValueGhs;
    case "CIF_PLUS_IMPORT_DUTY": {
      const importDuty = ctx.lineAmounts.get("IMPORT_DUTY");
      if (importDuty == null) throw new Error("IMPORT_DUTY required for CIF_PLUS_IMPORT_DUTY");
      return ctx.customsValueGhs.plus(importDuty);
    }
    case "FLAT":
      return moneyZero();
    case "ADMIN_OVERRIDE": {
      const key = opts?.chargeKey;
      if (!key) throw new Error("ADMIN_OVERRIDE requires chargeKey context");
      const override = ctx.adminOverrides.get(key);
      if (override == null) throw new Error(`Missing admin override for ${key}`);
      return override;
    }
    case "ASSESSED_EXTERNAL_BASE": {
      const key = opts?.chargeKey ?? "DEFAULT";
      const base = ctx.assessedExternalBases.get(key);
      if (base == null) throw new Error(`Missing assessed external base for ${key}`);
      return base;
    }
    case "PREVIOUS_LINE": {
      if (!opts?.previousLineKey) throw new Error("PREVIOUS_LINE requires previousLineKey");
      const prev = ctx.lineAmounts.get(opts.previousLineKey);
      if (prev == null) throw new Error(`Missing previous line ${opts.previousLineKey}`);
      return prev;
    }
    default:
      throw new Error(`Unhandled expression atom ${parsed.key}`);
  }
}

export function expressionDependencies(expression: string): string[] {
  const parsed = parseTaxableBaseExpression(expression);
  if (parsed.kind === "SELECTED_LINE") return [parsed.chargeKey];
  if (parsed.kind === "SUM_OF_LINES") return parsed.chargeKeys;
  if (parsed.kind === "CUSTOMS_VALUE_PLUS_SELECTED_LINES") return parsed.chargeKeys;
  if (parsed.kind === "ATOM" && parsed.key === "CIF_PLUS_IMPORT_DUTY") return ["IMPORT_DUTY"];
  return [];
}
