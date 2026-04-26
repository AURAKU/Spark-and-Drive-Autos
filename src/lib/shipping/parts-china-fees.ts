import { DeliveryMode, type Part, PartOrigin, type Prisma, PartStockStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ChinaShippingChoice = "AIR" | "SEA";

/** Customer-facing choice maps to catalog `DeliveryMode` (air uses standard template first). */
export function deliveryModeForChinaChoice(choice: ChinaShippingChoice): DeliveryMode {
  return choice === "SEA" ? DeliveryMode.SEA : DeliveryMode.AIR_STANDARD;
}

type PartWithOptions = Awaited<ReturnType<typeof loadPartsForChinaQuote>>[number];

async function loadPartsForChinaQuote(partIds: string[]) {
  const unique = [...new Set(partIds)];
  if (unique.length === 0) return [];
  return prisma.part.findMany({
    where: { id: { in: unique } },
    include: {
      deliveryOptions: {
        where: { enabled: true },
        include: { template: true },
      },
    },
  });
}

const templateByMode = async (mode: DeliveryMode) => {
  return prisma.deliveryOptionTemplate.findFirst({
    where: { mode, active: true },
    orderBy: { sortOrder: "asc" },
  });
};

/** GHS + ETA for a single part and a target delivery mode. */
export async function feeGhsForPartForDeliveryMode(
  part: PartWithOptions,
  mode: DeliveryMode,
): Promise<{ fee: number; eta: string | null }> {
  const pickOption = (m: DeliveryMode) => part.deliveryOptions.find((o) => o.template.mode === m && o.template.active);

  const opt = pickOption(mode) ?? null;
  if (opt) {
    const fee = opt.feeGhs != null ? Number(opt.feeGhs) : Number(opt.template.feeGhs);
    const eta = opt.etaLabel?.trim() || opt.template.etaLabel;
    return { fee, eta };
  }
  const t = await templateByMode(mode);
  if (t) {
    return { fee: Number(t.feeGhs), eta: t.etaLabel };
  }
  return { fee: 0, eta: null };
}

/**
 * Sum international shipping (GHS) for the given part IDs and a single `DeliveryMode`
 * (e.g. SEA, AIR_EXPRESS) using part overrides and templates.
 */
export async function computeChinaShippingForDeliveryMode(
  partIds: string[],
  mode: DeliveryMode,
): Promise<{ feeGhs: number; etaSummary: string }> {
  const parts = await loadPartsForChinaQuote(partIds);
  if (parts.length === 0) {
    return { feeGhs: 0, etaSummary: "Rates will be confirmed on payment." };
  }
  const etas: string[] = [];
  let feeGhs = 0;
  for (const p of parts) {
    const { fee, eta } = await feeGhsForPartForDeliveryMode(p, mode);
    if (Number.isFinite(fee) && fee > 0) feeGhs += fee;
    if (eta) etas.push(eta);
  }
  const etaSummary = etas.length > 0 ? [...new Set(etas)].join(" · ") : "See delivery notes after payment.";
  return { feeGhs, etaSummary };
}

export type ThreeModeChinaShippingQuotes = {
  express: { feeGhs: number; eta: string; mode: DeliveryMode };
  normalAir: { feeGhs: number; eta: string; mode: DeliveryMode };
  sea: { feeGhs: number; eta: string; mode: DeliveryMode };
};

/** Three explicit international options for China pre-order lines (separate from parts subtotal). */
export async function computeThreeModeChinaQuotesForPartIds(partIds: string[]): Promise<ThreeModeChinaShippingQuotes> {
  const unique = [...new Set(partIds)];
  const [ex, std, sea] = await Promise.all([
    computeChinaShippingForDeliveryMode(unique, DeliveryMode.AIR_EXPRESS),
    computeChinaShippingForDeliveryMode(unique, DeliveryMode.AIR_STANDARD),
    computeChinaShippingForDeliveryMode(unique, DeliveryMode.SEA),
  ]);
  return {
    express: { feeGhs: ex.feeGhs, eta: ex.etaSummary, mode: DeliveryMode.AIR_EXPRESS },
    normalAir: { feeGhs: std.feeGhs, eta: std.etaSummary, mode: DeliveryMode.AIR_STANDARD },
    sea: { feeGhs: sea.feeGhs, eta: sea.etaSummary, mode: DeliveryMode.SEA },
  };
}

type QuoteOpts = { forCheckout?: boolean };

/**
 * Air vs Sea (checkout): maps AIR to standard/express fallbacks. When `forCheckout` is true,
 * China + pre-order lines do not contribute to international fee (paid later).
 */
export async function computeChinaShippingQuote(
  partIds: string[],
  choice: ChinaShippingChoice,
  opts: QuoteOpts = {},
): Promise<{ feeGhs: number; etaSummary: string; deliveryMode: DeliveryMode }> {
  const deliveryMode = deliveryModeForChinaChoice(choice);
  const airFallbackModes: DeliveryMode[] = [DeliveryMode.AIR_STANDARD, DeliveryMode.AIR_EXPRESS];

  let idList = [...new Set(partIds)];
  if (opts.forCheckout) {
    const metas = await prisma.part.findMany({
      where: { id: { in: idList } },
      select: { id: true, origin: true, stockStatus: true },
    });
    const skip = (p: { origin: PartOrigin; stockStatus: PartStockStatus }) =>
      p.origin === PartOrigin.CHINA && p.stockStatus === PartStockStatus.ON_REQUEST;
    idList = metas.filter((m) => !skip(m as Pick<Part, "origin" | "stockStatus">)).map((m) => m.id);
  }

  const parts = await loadPartsForChinaQuote(idList);
  if (parts.length === 0) {
    return {
      feeGhs: 0,
      etaSummary: choice === "SEA" ? "No sea add-on in cart; international fee may be billed later." : "No air add-on in cart; international fee may be billed later.",
      deliveryMode,
    };
  }

  let feeGhs = 0;
  const etas: string[] = [];

  for (const part of parts) {
    let fee: number | null = null;
    let eta: string | null = null;
    const pickOption = (mode: DeliveryMode) => part.deliveryOptions.find((o) => o.template.mode === mode && o.template.active);

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

/** Air/Sea quotes for cart — excludes China pre-order from the add-on (paid separately). */
export type PartsChinaQuotes = {
  air: { feeGhs: number; eta: string };
  sea: { feeGhs: number; eta: string };
};

export async function computeChinaQuotesForPartIds(
  partIds: string[],
  forCheckout: boolean = true,
): Promise<PartsChinaQuotes> {
  const unique = [...new Set(partIds)];
  const [air, sea] = await Promise.all([
    computeChinaShippingQuote(unique, "AIR", { forCheckout: forCheckout }),
    computeChinaShippingQuote(unique, "SEA", { forCheckout: forCheckout }),
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
