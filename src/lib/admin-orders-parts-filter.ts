import type { Prisma } from "@prisma/client";
import { PartOrigin, PartStockStatus } from "@prisma/client";

export type AdminPartsLineage = "ghana" | "china_preorder" | null;

/**
 * Prisma `where` fragment for parts orders by fulfillment profile.
 * - `ghana`: all lines are Ghana stock (no China parts).
 * - `china_preorder`: at least one line is China + on-request (pre-order).
 */
export function wherePartsLineageForAdminList(lineage: AdminPartsLineage): Prisma.OrderWhereInput | undefined {
  if (!lineage) return undefined;
  if (lineage === "ghana") {
    return {
      kind: "PARTS",
      partItems: { some: {} },
      NOT: { partItems: { some: { origin: { not: PartOrigin.GHANA } } } },
    };
  }
  if (lineage === "china_preorder") {
    return {
      kind: "PARTS",
      partItems: {
        some: {
          origin: PartOrigin.CHINA,
          part: { is: { stockStatus: PartStockStatus.ON_REQUEST } },
        },
      },
    };
  }
  return undefined;
}

export function orderPartsLineageLabel(order: {
  kind: string;
  partItems: Array<{ origin: string; part: { stockStatus: string } | null }>;
}): "—" | "Ghana stock" | "China pre-order" | "Mixed" {
  if (order.kind !== "PARTS" || order.partItems.length === 0) return "—";
  const hasGhana = order.partItems.some((i) => i.origin === "GHANA");
  const hasChinaPre = order.partItems.some(
    (i) => i.origin === "CHINA" && i.part?.stockStatus === "ON_REQUEST",
  );
  const hasChinaInStock = order.partItems.some(
    (i) => i.origin === "CHINA" && i.part && i.part.stockStatus !== "ON_REQUEST",
  );
  const allGhana = order.partItems.every((i) => i.origin === "GHANA");
  if (allGhana) return "Ghana stock";
  if (hasChinaPre && !hasGhana && !hasChinaInStock) return "China pre-order";
  if (hasGhana || hasChinaPre || hasChinaInStock) return "Mixed";
  return "—";
}
