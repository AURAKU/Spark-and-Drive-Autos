import type { Prisma, PrismaClient } from "@prisma/client";

import { diceBigramSimilarity, normCollapse, significantTokens } from "@/lib/duplicate-clusters";

function norm(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function scorePartMatch(input: {
  title: string;
  sku?: string | null;
  category?: string | null;
  basePriceRmb?: number;
  row: { title: string; sku: string | null; category: string; basePriceRmb: unknown };
}): number {
  const titleA = normCollapse(input.title);
  const titleB = normCollapse(input.row.title);
  let score = 0;

  const skuA = input.sku?.trim().toLowerCase();
  const skuB = input.row.sku?.trim().toLowerCase();
  if (skuA && skuB && skuA === skuB) score += 0.98;

  if (titleA && titleA === titleB) score += 0.72;
  else {
    const dice = diceBigramSimilarity(input.title, input.row.title);
    score += dice * 0.78;
  }

  if (input.category && input.row.category && norm(input.category) === norm(input.row.category)) {
    score += 0.08;
  }

  if (input.basePriceRmb != null) {
    const diff = Math.abs(Number(input.row.basePriceRmb) - input.basePriceRmb);
    if (diff < 1) score += 0.12;
    else if (diff < Number(input.basePriceRmb) * 0.05) score += 0.05;
  }

  return Math.min(score, 1);
}

export async function detectLikelyPartDuplicates(
  prisma: PrismaClient,
  input: { title: string; sku?: string | null; category?: string | null; basePriceRmb?: number; excludeId?: string },
) {
  const keywords = significantTokens(input.title, 3, 8);
  const or: Prisma.PartWhereInput[] = [];
  const sku = input.sku?.trim();
  if (sku) or.push({ sku });
  for (const w of keywords.slice(0, 6)) {
    or.push({ title: { contains: w, mode: "insensitive" } });
  }
  const slice = input.title.trim().slice(0, 48);
  if (slice.length >= 4) {
    or.push({ title: { contains: slice, mode: "insensitive" } });
  }

  const where: Prisma.PartWhereInput =
    or.length > 0
      ? {
          ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
          OR: or,
        }
      : {
          ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
          title: { contains: input.title.trim().slice(0, 24), mode: "insensitive" },
        };

  const candidates = await prisma.part.findMany({
    where,
    take: 48,
    select: { id: true, title: true, sku: true, category: true, basePriceRmb: true },
  });

  const scored = candidates
    .map((c) => ({
      id: c.id,
      title: c.title,
      score: scorePartMatch({
        title: input.title,
        sku: input.sku,
        category: input.category,
        basePriceRmb: input.basePriceRmb,
        row: c,
      }),
    }))
    .filter((c) => c.score >= 0.62)
    .sort((a, b) => b.score - a.score);

  const dedup = new Map<string, (typeof scored)[0]>();
  for (const s of scored) dedup.set(s.id, s);
  return [...dedup.values()].slice(0, 12);
}

function scoreCarMatch(input: {
  title: string;
  brand: string;
  model: string;
  year: number;
  vin?: string | null;
  basePriceRmb?: number;
  row: {
    title: string;
    brand: string;
    model: string;
    year: number;
    vin: string | null;
    basePriceRmb: unknown;
  };
}): number {
  const vinA = input.vin?.trim().toUpperCase();
  const vinB = input.row.vin?.trim().toUpperCase();
  if (vinA && vinB && vinA.length >= 8 && vinA === vinB) {
    return 1;
  }

  let score = 0;
  const sameListing =
    normCollapse(input.brand) === normCollapse(input.row.brand) &&
    normCollapse(input.model) === normCollapse(input.row.model) &&
    input.year === input.row.year;

  if (sameListing) {
    score += 0.72;
    const titleDice = diceBigramSimilarity(input.title, input.row.title);
    score += titleDice * 0.22;
    if (norm(input.title) === norm(input.row.title)) score += 0.18;
    if (input.basePriceRmb != null) {
      const diff = Math.abs(Number(input.row.basePriceRmb) - input.basePriceRmb);
      if (diff < 1) score += 0.08;
    }
  } else {
    score += diceBigramSimilarity(input.title, input.row.title) * 0.35;
  }

  return Math.min(score, 1);
}

export async function detectLikelyCarDuplicates(
  prisma: PrismaClient,
  input: {
    title: string;
    brand: string;
    model: string;
    year: number;
    vin?: string | null;
    basePriceRmb?: number;
    excludeId?: string;
  },
) {
  const or: Prisma.CarWhereInput[] = [];
  const vin = input.vin?.trim().toUpperCase();
  if (vin && vin.length >= 8) {
    or.push({ vin: { equals: vin, mode: "insensitive" } });
  }
  or.push({
    brand: { equals: input.brand, mode: "insensitive" },
    model: { equals: input.model, mode: "insensitive" },
    year: input.year,
  });

  const rows = await prisma.car.findMany({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: or,
    },
    take: 20,
    select: { id: true, title: true, brand: true, model: true, year: true, vin: true, basePriceRmb: true },
  });

  const scored = rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      score: scoreCarMatch({
        title: input.title,
        brand: input.brand,
        model: input.model,
        year: input.year,
        vin: input.vin,
        basePriceRmb: input.basePriceRmb,
        row: r,
      }),
    }))
    .filter((x) => x.score >= 0.68)
    .sort((a, b) => b.score - a.score);

  const dedup = new Map<string, (typeof scored)[0]>();
  for (const s of scored) dedup.set(s.id, s);
  return [...dedup.values()].slice(0, 12);
}
