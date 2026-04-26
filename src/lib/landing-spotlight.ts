import {
  CarListingState,
  OrderKind,
  OrderStatus,
  PartListingState,
  type Car,
  type Part,
} from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

/** ~17 minutes — between 15–20 min so the homepage mix refreshes on a predictable cadence. */
export const LANDING_SPOTLIGHT_SLOT_MS = 17 * 60 * 1000;

const SALES_LOOKBACK_DAYS = 90;
const MAX_CANDIDATES = 36;
const SPOTLIGHT_CARS = 3;
const SPOTLIGHT_PARTS = 3;

export type SpotlightCar = Pick<
  Car,
  | "id"
  | "slug"
  | "title"
  | "brand"
  | "model"
  | "year"
  | "location"
  | "sourceType"
  | "availabilityStatus"
  | "listingState"
  | "coverImageUrl"
  | "basePriceRmb"
>;

export type SpotlightPart = Pick<
  Part,
  "id" | "slug" | "title" | "shortDescription" | "priceGhs" | "basePriceRmb" | "origin" | "category" | "stockStatus" | "stockQty" | "coverImageUrl"
>;

export type SpotlightEntry = { kind: "car"; car: SpotlightCar } | { kind: "part"; part: SpotlightPart };

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed >>> 0);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

const EXCLUDED_ORDER: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CANCELLED,
];

export async function getHomeSpotlight(): Promise<{
  entries: SpotlightEntry[];
  slotStartedAt: Date;
  nextRotationAt: Date;
  seed: number;
}> {
  const now = Date.now();
  const slotIndex = Math.floor(now / LANDING_SPOTLIGHT_SLOT_MS);
  const seed = slotIndex * 1_000_003 + 42_069;
  const slotStartedAt = new Date(slotIndex * LANDING_SPOTLIGHT_SLOT_MS);
  const nextRotationAt = new Date((slotIndex + 1) * LANDING_SPOTLIGHT_SLOT_MS);

  const since = new Date(now - SALES_LOOKBACK_DAYS * 864e5);

  const [carSalesGroups, partLines, featuredCars, recentCars, featuredParts, recentParts] = await Promise.all([
    prisma.order
      .groupBy({
        by: ["carId"],
        where: {
          kind: OrderKind.CAR,
          carId: { not: null },
          createdAt: { gte: since },
          orderStatus: { notIn: EXCLUDED_ORDER },
        },
        _count: { _all: true },
      })
      .catch(() => [] as { carId: string | null; _count: { _all: number } }[]),
    prisma.partOrderItem
      .findMany({
        where: {
          partId: { not: null },
          order: {
            kind: OrderKind.PARTS,
            createdAt: { gte: since },
            orderStatus: { notIn: EXCLUDED_ORDER },
          },
        },
        select: { partId: true, quantity: true },
        take: 4000,
      })
      .catch(() => [] as { partId: string | null; quantity: number }[]),
    prisma.car.findMany({
      where: { listingState: CarListingState.PUBLISHED, featured: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        slug: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        location: true,
        sourceType: true,
        availabilityStatus: true,
        listingState: true,
        coverImageUrl: true,
        basePriceRmb: true,
      },
    }),
    prisma.car.findMany({
      where: { listingState: CarListingState.PUBLISHED },
      orderBy: { updatedAt: "desc" },
      skip: (seed % 8) * 2,
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        location: true,
        sourceType: true,
        availabilityStatus: true,
        listingState: true,
        coverImageUrl: true,
        basePriceRmb: true,
      },
    }),
    prisma.part.findMany({
      where: { listingState: PartListingState.PUBLISHED, stockQty: { gte: 1 }, featured: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceGhs: true,
        basePriceRmb: true,
        origin: true,
        category: true,
        stockStatus: true,
        stockQty: true,
        coverImageUrl: true,
      },
    }),
    prisma.part.findMany({
      where: { listingState: PartListingState.PUBLISHED, stockQty: { gte: 1 } },
      orderBy: { updatedAt: "desc" },
      skip: (seed % 6) * 3,
      take: 24,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceGhs: true,
        basePriceRmb: true,
        origin: true,
        category: true,
        stockStatus: true,
        stockQty: true,
        coverImageUrl: true,
      },
    }),
  ]);

  const carSales = new Map<string, number>();
  for (const row of carSalesGroups) {
    if (row.carId) carSales.set(row.carId, row._count._all);
  }
  const bestCarIds = [...carSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 24);

  let bestCars: SpotlightCar[] = [];
  if (bestCarIds.length > 0) {
    bestCars = await prisma.car.findMany({
      where: { id: { in: bestCarIds }, listingState: CarListingState.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        location: true,
        sourceType: true,
        availabilityStatus: true,
        listingState: true,
        coverImageUrl: true,
        basePriceRmb: true,
      },
    });
    bestCars.sort((a, b) => (carSales.get(b.id) ?? 0) - (carSales.get(a.id) ?? 0));
  }

  const partSales = new Map<string, number>();
  for (const line of partLines) {
    if (!line.partId) continue;
    partSales.set(line.partId, (partSales.get(line.partId) ?? 0) + line.quantity);
  }
  const bestPartIds = [...partSales.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 24);

  let bestParts: SpotlightPart[] = [];
  if (bestPartIds.length > 0) {
    bestParts = await prisma.part.findMany({
      where: {
        id: { in: bestPartIds },
        listingState: PartListingState.PUBLISHED,
        stockQty: { gte: 1 },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceGhs: true,
        basePriceRmb: true,
        origin: true,
        category: true,
        stockStatus: true,
        stockQty: true,
        coverImageUrl: true,
      },
    });
    bestParts.sort((a, b) => (partSales.get(b.id) ?? 0) - (partSales.get(a.id) ?? 0));
  }

  const carPool = uniqueById([...bestCars, ...featuredCars, ...recentCars]).slice(0, MAX_CANDIDATES);
  const partPool = uniqueById([...bestParts, ...featuredParts, ...recentParts]).slice(0, MAX_CANDIDATES);

  const shuffledCars = shuffle(carPool, seed);
  const shuffledParts = shuffle(partPool, seed ^ 0x9e3779b9);

  const pickedCars = shuffledCars.slice(0, SPOTLIGHT_CARS);
  const pickedParts = shuffledParts.slice(0, SPOTLIGHT_PARTS);

  let entries: SpotlightEntry[] = shuffle(
    [
      ...pickedCars.map((car) => ({ kind: "car" as const, car })),
      ...pickedParts.map((part) => ({ kind: "part" as const, part })),
    ],
    seed ^ 0xdeadbeef,
  );

  if (entries.length === 0) {
    const [fc, fp] = await Promise.all([
      prisma.car.findMany({
        where: { listingState: CarListingState.PUBLISHED },
        take: SPOTLIGHT_CARS,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          brand: true,
          model: true,
          year: true,
          location: true,
          sourceType: true,
          availabilityStatus: true,
          listingState: true,
          coverImageUrl: true,
          basePriceRmb: true,
        },
      }),
      prisma.part.findMany({
        where: { listingState: PartListingState.PUBLISHED, stockQty: { gte: 1 } },
        take: SPOTLIGHT_PARTS,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          priceGhs: true,
          basePriceRmb: true,
          origin: true,
          category: true,
          stockStatus: true,
          stockQty: true,
          coverImageUrl: true,
        },
      }),
    ]);
    entries = shuffle(
      [
        ...fc.map((car) => ({ kind: "car" as const, car })),
        ...fp.map((part) => ({ kind: "part" as const, part })),
      ],
      seed ^ 0xabc,
    );
  }

  return { entries, slotStartedAt, nextRotationAt, seed };
}

/**
 * Cached spotlight for faster homepage responses under load.
 * Revalidates every 5 minutes, while slot logic still keeps rotation deterministic.
 */
export const getHomeSpotlightCached = unstable_cache(getHomeSpotlight, ["landing-spotlight:v1"], {
  revalidate: 300,
});
