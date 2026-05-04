import type { DeliveryFeeCurrency, DeliveryMode } from "@prisma/client";

import { adminFeeAmountForDisplay } from "@/lib/delivery-template-fees";
import { fallbackGlobalCurrencySettings, getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

export const PARTS_DELIVERY_DEFAULTS: Record<DeliveryMode, { name: string; etaLabel: string }> = {
  AIR_EXPRESS: { name: "Air Delivery Express", etaLabel: "3 days" },
  AIR_STANDARD: { name: "Normal Air Delivery", etaLabel: "5-10 days" },
  SEA: { name: "Sea Shipping", etaLabel: "35-45 days" },
};

export const PARTS_DELIVERY_MODES = Object.keys(PARTS_DELIVERY_DEFAULTS) as DeliveryMode[];

export type PartsDeliveryRowsSerialized = Record<
  string,
  {
    mode: DeliveryMode;
    name: string;
    etaLabel: string;
    feeGhs: number;
    feeRmb: number;
    feeCurrency: DeliveryFeeCurrency;
    feeAmount: number;
    weightKg: number | null;
    volumeCbm: number | null;
  } | null
>;

export async function loadPartsDeliveryTemplatesPanelProps() {
  const fx = await getGlobalCurrencySettings().catch(() => fallbackGlobalCurrencySettings());
  const deliveryRows = await prisma.deliveryOptionTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { mode: "asc" }],
  });
  const deliveryByMode = new Map(deliveryRows.map((r) => [r.mode, r]));
  const deliveryRowsSerialized: PartsDeliveryRowsSerialized = {};
  for (const mode of PARTS_DELIVERY_MODES) {
    const row = deliveryByMode.get(mode);
    deliveryRowsSerialized[mode] = row
      ? {
          mode: row.mode,
          name: row.name,
          etaLabel: row.etaLabel,
          feeGhs: Number(row.feeGhs),
          feeRmb: Number(row.feeRmb),
          feeCurrency: row.feeCurrency,
          feeAmount: adminFeeAmountForDisplay(Number(row.feeGhs), row.feeCurrency, fx),
          weightKg: row.weightKg != null ? Number(row.weightKg) : null,
          volumeCbm: row.volumeCbm != null ? Number(row.volumeCbm) : null,
        }
      : null;
  }
  return {
    modes: PARTS_DELIVERY_MODES,
    deliveryDefaults: PARTS_DELIVERY_DEFAULTS,
    rowsByMode: deliveryRowsSerialized,
  };
}
