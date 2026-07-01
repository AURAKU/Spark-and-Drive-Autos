import type { CalculationLineItem, LoadedChargeTemplate } from "../types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveChargeAmount(template: LoadedChargeTemplate, cifGhs: number, calibrationFactor = 1): number {
  if (template.calculationType === "PERCENTAGE" && template.rateValue != null) {
    return round2(cifGhs * template.rateValue * calibrationFactor);
  }
  if (template.amountGhs != null) {
    return round2(template.amountGhs * calibrationFactor);
  }
  return 0;
}

export function runChargeEngine(params: {
  templates: LoadedChargeTemplate[];
  category: "PORT" | "SHIPPING_LINE" | "AGENT";
  cifGhs: number;
  shippingLineId?: string | null;
  calibrationFactors: Record<string, number>;
  source: CalculationLineItem["source"];
}): CalculationLineItem[] {
  const items: CalculationLineItem[] = [];
  const filtered = params.templates.filter((t) => {
    if (t.category !== params.category) return false;
    if (params.category === "SHIPPING_LINE" && params.shippingLineId) {
      return t.shippingLineId === params.shippingLineId || t.shippingLineId == null;
    }
    return true;
  });

  for (const template of filtered) {
    const calKey =
      params.category === "PORT"
        ? `PORT_${template.subcategory}`
        : params.category === "SHIPPING_LINE"
          ? `SHIPPING_${template.subcategory}`
          : `AGENT_${template.subcategory}`;
    const factor = params.calibrationFactors[calKey] ?? params.calibrationFactors[params.category] ?? 1;
    const amount = resolveChargeAmount(template, params.cifGhs, factor);
    if (amount <= 0) continue;

    const categoryMap = {
      PORT: "PORT" as const,
      SHIPPING_LINE: "SHIPPING_LINE" as const,
      AGENT: "AGENT" as const,
    };

    items.push({
      code: `${params.category}_${template.subcategory}`,
      label: template.label,
      category: categoryMap[params.category],
      amountGhs: amount,
      basis:
        template.sampleCount > 0
          ? `Historical average from ${template.sampleCount} verified import(s)`
          : template.calculationType === "PERCENTAGE"
            ? `${(template.rateValue ?? 0) * 100}% of CIF`
            : "Configured template amount",
      formula:
        template.calculationType === "PERCENTAGE"
          ? `CIF ${params.cifGhs.toLocaleString("en-GH")} × ${((template.rateValue ?? 0) * 100).toFixed(2)}% × cal ${factor.toFixed(3)}`
          : `GHS ${template.amountGhs ?? 0} × cal ${factor.toFixed(3)}`,
      rate: template.rateValue ?? undefined,
      rateType: template.calculationType,
      source: factor !== 1 ? "PREDICTION" : params.source,
    });
  }

  return items;
}
