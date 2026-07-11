import { AvailabilityStatus, CarListingState, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";

import { STOREFRONT_CAR_CARD_SELECT } from "@/lib/storefront-car-card-select";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Lightweight inventory search for the compare vehicle picker. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const excludeRaw = (url.searchParams.get("exclude") ?? "").trim();
  const exclude = excludeRaw
    ? excludeRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const limitParam = parseInt(url.searchParams.get("limit") ?? "12", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 12, 1), 24);

  const cars = await prisma.car.findMany({
    where: {
      listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] },
      sourceType: { in: [SourceType.IN_GHANA, SourceType.IN_CHINA] },
      availabilityStatus: { not: AvailabilityStatus.IN_TRANSIT_STOCK },
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: STOREFRONT_CAR_CARD_SELECT,
    orderBy: [{ listingState: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    cars: cars.map((car) => ({
      id: car.id,
      slug: car.slug,
      title: car.title,
      brand: car.brand,
      year: car.year,
      coverImageUrl: car.coverImageUrl,
    })),
  });
}
