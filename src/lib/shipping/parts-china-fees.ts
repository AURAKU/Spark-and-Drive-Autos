import { DeliveryMode, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ChinaShippingChoice = "AIR" | "SEA";

/** Customer-facing choice maps to catalog `DeliveryMode` (air uses standard template first). */
export function deliveryModeForChinaChoice(choice: ChinaShippingChoice): DeliveryMode {
  return choice === "SEA" ? DeliveryMode.SEA : DeliveryMode.AIR_STANDARD;
}

/**
 * Sum shipping fees for China-origin parts using enabled `PartDeliveryOption` rows,
 * falling back to active `DeliveryOptionTemplate` when a part has no override.
 */
export async function computeChinaShippingQuote(
  partIds: string[],
  choice: ChinaShippingChoice,
): Promise<{ feeGhs: number; etaSummary: string; deliveryMode: DeliveryMode }> {
  const deliveryMode = deliveryModeForChinaChoice(choice);
  const airFallbackModes: DeliveryMode[] = [DeliveryMode.AIR_STANDARD, DeliveryMode.AIR_EXPRESS];

  const parts = await prisma.part.findMany({
    where: { id: { in: partIds } },
    include: {
      deliveryOptions: {
        where: { enabled: true },
        include: { template: true },
      },
    },
  });

  const templateByMode = async (mode: DeliveryMode) => {
    return prisma.deliveryOptionTemplate.findFirst({
      where: { mode, active: true },
      orderBy: { sortOrder: "asc" },
    });
  };

  let feeGhs = 0;
  const etas: string[] = [];

  for (const part of parts) {
    let fee: number | null = null;
    let eta: string | null = null;

    const pickOption = (mode: DeliveryMode) =>
      part.deliveryOptions.find((o) => o.template.mode === mode && o.template.active);

    if (choice === "SEA") {
      const opt = pickOption(DeliveryMode.SEA) ?? null;
      if (opt) {
        fee = opt.feeGhs != null ? Number(opt.feeGhs) : Number(opt.template.feeGhs);
        eta = opt.etaLabel?.trim() || opt.template.etaLabel;
      } else {
        const t = await templateByMode(DeliveryMode.SEA);
        if (t) {
          fee = Number(t.feeGhs);
          eta = t.etaLabel;
        }
      }
    } else {
      let opt = pickOption(DeliveryMode.AIR_STANDARD) ?? pickOption(DeliveryMode.AIR_EXPRESS);
      if (!opt) {
        for (const m of airFallbackModes) {
          opt = pickOption(m) ?? opt;
          if (opt) break;
        }
      }
      if (opt) {
        fee = opt.feeGhs != null ? Number(opt.feeGhs) : Number(opt.template.feeGhs);
        eta = opt.etaLabel?.trim() || opt.template.etaLabel;
      } else {
        for (const m of airFallbackModes) {
          const t = await templateByMode(m);
          if (t) {
            fee = Number(t.feeGhs);
            eta = t.etaLabel;
            break;
          }
        }
      }
    }

    if (fee != null && Number.isFinite(fee)) feeGhs += fee;
    if (eta) etas.push(eta);
  }

  const etaSummary =
    etas.length > 0
      ? [...new Set(etas)].join(" · ")
      : choice === "SEA"
        ? "Sea freight typically several weeks depending on vessel schedule."
        : "Air freight typically 10–20 business days depending on consolidation.";

  return { feeGhs, etaSummary, deliveryMode };
}

/** Customer-facing Air/Sea quotes for checkout (GHS fee + ETA copy). */
export type PartsChinaQuotes = {
  air: { feeGhs: number; eta: string };
  sea: { feeGhs: number; eta: string };
};

export async function computeChinaQuotesForPartIds(partIds: string[]): Promise<PartsChinaQuotes> {
  const unique = [...new Set(partIds)];
  const [air, sea] = await Promise.all([
    computeChinaShippingQuote(unique, "AIR"),
    computeChinaShippingQuote(unique, "SEA"),
  ]);
  return {
    air: { feeGhs: air.feeGhs, eta: air.etaSummary },
    sea: { feeGhs: sea.feeGhs, eta: sea.etaSummary },
  };
}

export type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;
