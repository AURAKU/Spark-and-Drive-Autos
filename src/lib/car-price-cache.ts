import { Prisma } from "@prisma/client";

import { getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

/** Recompute stored GHS `price` on every car from `basePriceRmb` + current FX (run after admin rate changes). */
export async function recomputeAllCarCachedGhsPrices(): Promise<void> {
  const settings = await getGlobalCurrencySettings();
  const cars = await prisma.car.findMany({ select: { id: true, basePriceRmb: true } });
  if (cars.length === 0) return;
  await prisma.$transaction(
    cars.map((c) =>
      prisma.car.update({
        where: { id: c.id },
        data: {
          price: getCarDisplayPrice(Number(c.basePriceRmb), "GHS", settings),
          currency: "GHS",
        },
      })
    )
  );
}

/** Recompute cached `priceGhs` on parts from `basePriceRmb` + current FX (legacy column; storefront uses RMB + FX live). */
export async function recomputeAllPartCachedGhsPrices(): Promise<void> {
  const settings = await getGlobalCurrencySettings();
  const parts = await prisma.part.findMany({ select: { id: true, basePriceRmb: true } });
  if (parts.length === 0) return;
  await prisma.$transaction(
    parts.map((p) =>
      prisma.part.update({
        where: { id: p.id },
        data: {
          priceGhs: new Prisma.Decimal(getCarDisplayPrice(Number(p.basePriceRmb), "GHS", settings)),
        },
      })
    )
  );
}
