import type { CalculatedChargeLine } from "./calculation-engine";

export function normalizeEngineLines(lines: CalculatedChargeLine[]): CalculatedChargeLine[] {
  const byKey = new Map<string, CalculatedChargeLine>();
  for (const line of lines) {
    if (byKey.has(line.chargeKey)) {
      throw new Error(`Duplicate charge line key ${line.chargeKey}`);
    }
    byKey.set(line.chargeKey, line);
  }
  return [...byKey.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function linesToCalculationLineItems(lines: CalculatedChargeLine[]) {
  return normalizeEngineLines(lines).map((line) => ({
    code: line.chargeKey,
    label: line.chargeName,
    category: line.category,
    amountGhs: line.amountGhs,
    basis: `${line.taxableBaseExpression} = ${line.taxableBaseGhs.toLocaleString("en-GH")} GHS`,
    formula: line.formula,
    rate: line.rate != null ? Number(line.rate) : undefined,
    rateType: line.rate != null ? "PERCENTAGE" : "FIXED",
    source: "CONFIG" as const,
  }));
}
