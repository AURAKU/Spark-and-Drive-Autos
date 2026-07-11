import type { CalculationLineItem } from "@/lib/duty-intelligence/types";

export type LineItemGroupKey =
  | "CUSTOMS_DUTY"
  | "CONSUMPTION_TAXES"
  | "STATUTORY_LEVIES"
  | "NETWORK_PROCESSING"
  | "FIXED_ADMIN"
  | "VALUATION"
  | "OTHER";

export type GroupedLineItem = CalculationLineItem & {
  group: LineItemGroupKey;
  groupLabel: string;
};

const GROUP_LABELS: Record<LineItemGroupKey, string> = {
  CUSTOMS_DUTY: "Customs duty",
  CONSUMPTION_TAXES: "Consumption / import taxes",
  STATUTORY_LEVIES: "Statutory levies",
  NETWORK_PROCESSING: "Network / processing charges",
  FIXED_ADMIN: "Fixed / administrative charges",
  VALUATION: "Valuation (FOB, freight, insurance, CIF)",
  OTHER: "Other charges",
};

function classifyLine(code: string, category: CalculationLineItem["category"]): LineItemGroupKey {
  const upper = code.toUpperCase();
  if (["FOB", "FREIGHT", "INSURANCE", "CIF", "CUSTOMS"].includes(category)) return "VALUATION";
  if (upper.includes("IMPORT_DUTY") || upper === "DUTY") return "CUSTOMS_DUTY";
  if (upper.includes("VAT") || upper.includes("NHIL") || upper.includes("GETFUND")) {
    if (upper.includes("NETWORK")) return "NETWORK_PROCESSING";
    return "CONSUMPTION_TAXES";
  }
  if (
    upper.includes("LEVY") ||
    upper.includes("ECOWAS") ||
    upper.includes("EXIM") ||
    upper.includes("AU_") ||
    upper.includes("SPECIAL_IMPORT")
  ) {
    return "STATUTORY_LEVIES";
  }
  if (upper.includes("NETWORK") || upper.includes("EXAMINATION")) return "NETWORK_PROCESSING";
  if (upper.includes("FEE") || upper.includes("DISINFECTION") || upper.includes("IDF")) return "FIXED_ADMIN";
  if (category === "DUTY") return "CUSTOMS_DUTY";
  if (category === "VAT") return "CONSUMPTION_TAXES";
  if (category === "LEVY") return "STATUTORY_LEVIES";
  if (category === "FEE") return "FIXED_ADMIN";
  return "OTHER";
}

/** Group line items and dedupe by code to avoid double-counting. */
export function groupLineItems(items: CalculationLineItem[]): { group: LineItemGroupKey; label: string; items: GroupedLineItem[] }[] {
  const seen = new Set<string>();
  const grouped = new Map<LineItemGroupKey, GroupedLineItem[]>();

  for (const item of items) {
    if (item.category === "TOTAL") continue;
    if (seen.has(item.code)) continue;
    seen.add(item.code);

    const group = classifyLine(item.code, item.category);
    const row: GroupedLineItem = { ...item, group, groupLabel: GROUP_LABELS[group] };
    const bucket = grouped.get(group) ?? [];
    bucket.push(row);
    grouped.set(group, bucket);
  }

  const order: LineItemGroupKey[] = [
    "VALUATION",
    "CUSTOMS_DUTY",
    "CONSUMPTION_TAXES",
    "STATUTORY_LEVIES",
    "NETWORK_PROCESSING",
    "FIXED_ADMIN",
    "OTHER",
  ];

  return order
    .filter((g) => grouped.has(g))
    .map((g) => ({ group: g, label: GROUP_LABELS[g], items: grouped.get(g)! }));
}
