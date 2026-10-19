import { PartListingState } from "@prisma/client";
import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { normalizePartSearch, partSearchOr } from "@/lib/part-catalog-query";
import { publicStockLabel } from "@/lib/part-stock-class";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const limited = await rateLimitForm(`parts-suggest:${ip}`);
  if (!limited.success) {
    return NextResponse.json({ products: [], oems: [], categories: [] }, { status: 429 });
  }

  const query = normalizePartSearch(new URL(req.url).searchParams.get("q") ?? "");
  if (query.length < 2) {
    return NextResponse.json({ products: [], oems: [], categories: [] });
  }

  const where = {
    listingState: PartListingState.PUBLISHED,
    OR: partSearchOr(query),
  };

  const [products, categories] = await Promise.all([
    prisma.part.findMany({
      where,
      take: 6,
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      select: { slug: true, title: true, oemNumber: true, partNumber: true, origin: true, category: true },
    }),
    prisma.part.findMany({
      where: {
        listingState: PartListingState.PUBLISHED,
        category: { contains: query, mode: "insensitive" },
      },
      distinct: ["category"],
      take: 4,
      select: { category: true },
    }),
  ]);

  const oems = products
    .filter((part) => {
      const code = (part.oemNumber ?? part.partNumber ?? "").toLowerCase();
      const compact = query.replace(/[\s-]/g, "").toLowerCase();
      return code.includes(query.toLowerCase()) || (compact.length >= 3 && code.replace(/[\s-]/g, "").includes(compact));
    })
    .slice(0, 4)
    .map((part) => ({
      oemNumber: part.oemNumber ?? part.partNumber ?? "",
      slug: part.slug,
      title: part.title,
    }))
    .filter((row) => row.oemNumber);

  return NextResponse.json({
    products: products.slice(0, 5).map((part) => ({
      slug: part.slug,
      title: part.title,
      oemNumber: part.oemNumber,
      stockLabel: publicStockLabel(part.origin),
    })),
    oems,
    categories: categories.map((row) => row.category),
  });
}
