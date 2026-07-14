import type { Prisma } from "@prisma/client";
import { CarListingState, EngineType, SourceType } from "@prisma/client";

export const MOTORCYCLE_ADMIN_PAGE_SIZE = 15;

export type MotorcycleAdminFilters = {
  q: string;
  brand: string;
  model: string;
  year: string;
  status: string;
  location: string;
  fuel: string;
  transmission: string;
  published: "" | "published" | "unpublished" | "archived" | "deleted";
  page: number;
};

function firstString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0]?.trim() ?? "";
  return typeof v === "string" ? v.trim() : "";
}

export function parseMotorcycleAdminFilters(
  sp: Record<string, string | string[] | undefined>,
): MotorcycleAdminFilters {
  const publishedRaw = firstString(sp.published);
  const published =
    publishedRaw === "published" ||
    publishedRaw === "unpublished" ||
    publishedRaw === "archived" ||
    publishedRaw === "deleted"
      ? publishedRaw
      : "";
  const pageRaw = parseInt(firstString(sp.page) || "1", 10);
  return {
    q: firstString(sp.q),
    brand: firstString(sp.brand),
    model: firstString(sp.model),
    year: firstString(sp.year),
    status: firstString(sp.status),
    location: firstString(sp.location),
    fuel: firstString(sp.fuel),
    transmission: firstString(sp.transmission),
    published,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function motorcycleAdminWhere(filters: MotorcycleAdminFilters): Prisma.MotorcycleWhereInput {
  const and: Prisma.MotorcycleWhereInput[] = [];

  if (filters.published === "deleted") {
    and.push({ deletedAt: { not: null } });
  } else {
    and.push({ deletedAt: null });
  }

  if (filters.published === "published") {
    and.push({ listingState: CarListingState.PUBLISHED });
  } else if (filters.published === "unpublished") {
    and.push({ listingState: { in: [CarListingState.DRAFT, CarListingState.HIDDEN] } });
  } else if (filters.published === "archived") {
    and.push({
      OR: [{ archivedAt: { not: null } }, { listingState: CarListingState.HIDDEN }],
    });
  }

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { brand: { contains: filters.q, mode: "insensitive" } },
        { model: { contains: filters.q, mode: "insensitive" } },
        { slug: { contains: filters.q, mode: "insensitive" } },
        { location: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.brand) and.push({ brand: { contains: filters.brand, mode: "insensitive" } });
  if (filters.model) and.push({ model: { contains: filters.model, mode: "insensitive" } });
  if (filters.year) {
    const y = parseInt(filters.year, 10);
    if (Number.isFinite(y)) and.push({ year: y });
  }
  if (filters.status) {
    and.push({ availabilityStatus: filters.status as Prisma.EnumAvailabilityStatusFilter["equals"] });
  }
  if (filters.location) {
    and.push({
      OR: [
        { location: { contains: filters.location, mode: "insensitive" } },
        ...(filters.location.toLowerCase().includes("ghana")
          ? [{ sourceType: SourceType.IN_GHANA }]
          : []),
        ...(filters.location.toLowerCase().includes("china")
          ? [{ sourceType: SourceType.IN_CHINA }]
          : []),
        ...(filters.location.toLowerCase().includes("transit")
          ? [{ sourceType: SourceType.IN_TRANSIT }]
          : []),
      ],
    });
  }
  if (filters.fuel && (Object.values(EngineType) as string[]).includes(filters.fuel)) {
    and.push({ engineType: filters.fuel as EngineType });
  }
  if (filters.transmission) {
    and.push({ transmission: { contains: filters.transmission, mode: "insensitive" } });
  }

  return and.length ? { AND: and } : {};
}

export function motorcycleAdminListHref(
  filters: MotorcycleAdminFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.model) params.set("model", filters.model);
  if (filters.year) params.set("year", filters.year);
  if (filters.status) params.set("status", filters.status);
  if (filters.location) params.set("location", filters.location);
  if (filters.fuel) params.set("fuel", filters.fuel);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.published) params.set("published", filters.published);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/motorcycles?${qs}` : "/admin/motorcycles";
}

/** Public listings exclude soft-deleted bikes. */
export function publicMotorcycleWhere(
  extra?: Prisma.MotorcycleWhereInput,
): Prisma.MotorcycleWhereInput {
  return {
    AND: [{ deletedAt: null }, ...(extra ? [extra] : [])],
  };
}
