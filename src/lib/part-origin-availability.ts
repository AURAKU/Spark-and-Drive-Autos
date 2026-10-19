import { PartOrigin, PartStockStatus, type Part } from "@prisma/client";

import { publicStockLabel } from "@/lib/part-stock-class";

export type PartOriginAvailabilityUi = {
  label: string;
  className: string;
};

/**
 * Public labels are Ghana Stock and Overseas Stock.
 * CHINA remains the stored origin and is shown as Overseas Stock.
 */
export function partOriginAvailabilityUi(
  part: Pick<Part, "origin" | "stockStatus">,
): PartOriginAvailabilityUi {
  if (part.origin === PartOrigin.GHANA) {
    return {
      label: publicStockLabel(part.origin),
      className:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100",
    };
  }
  if (part.origin === PartOrigin.CHINA) {
    if (part.stockStatus === PartStockStatus.ON_REQUEST) {
      return {
        label: "Overseas Stock · Pre-order",
        className:
          "border-amber-500/40 bg-amber-500/15 text-amber-100 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-100",
      };
    }
    return {
      label: publicStockLabel(part.origin),
      className:
        "border-sky-500/40 bg-sky-500/12 text-sky-100 dark:border-sky-400/35 dark:bg-sky-500/10 dark:text-sky-100",
    };
  }
  return {
    label: "View details",
    className: "border-border bg-background/80 text-foreground",
  };
}
