import { PartListingState, type PartOrigin, type Prisma } from "@prisma/client";

const MAX_QUERY = 80;

export function normalizePartSearch(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);
}

/** Raw query plus a hyphen/space-stripped form so OEM numbers match either way. */
export function partSearchVariants(query: string): string[] {
  const compact = query.replace(/[\s-]/g, "");
  if (compact.length >= 3 && compact.toLowerCase() !== query.toLowerCase()) return [query, compact];
  return [query];
}

function contains(term: string): { contains: string; mode: "insensitive" } {
  return { contains: term, mode: "insensitive" };
}

export function partSearchOr(query: string): Prisma.PartWhereInput[] {
  return partSearchVariants(query).flatMap((term) => [
    { title: contains(term) },
    { shortDescription: contains(term) },
    { category: contains(term) },
    { oemNumber: contains(term) },
    { partNumber: contains(term) },
    { sku: contains(term) },
    { brand: contains(term) },
    { compatibleMake: contains(term) },
    { compatibleModel: contains(term) },
  ]);
}

export function buildPartCatalogWhere(input: {
  q: string;
  category: string;
  origin?: PartOrigin;
  make: string;
  model: string;
}): Prisma.PartWhereInput {
  const search = input.q ? partSearchOr(input.q) : [];
  return {
    listingState: PartListingState.PUBLISHED,
    AND: [
      search.length > 0 ? { OR: search } : {},
      input.category ? { category: { equals: input.category, mode: "insensitive" } } : {},
      input.origin ? { origin: input.origin } : {},
      input.make ? { compatibleMake: { equals: input.make, mode: "insensitive" } } : {},
      input.model ? { compatibleModel: { equals: input.model, mode: "insensitive" } } : {},
    ],
  };
}

export function partExactCodeWhere(query: string): Prisma.PartWhereInput {
  const codes = partSearchVariants(query).flatMap((term) => [
    { oemNumber: { equals: term, mode: "insensitive" as const } },
    { partNumber: { equals: term, mode: "insensitive" as const } },
    { sku: { equals: term, mode: "insensitive" as const } },
  ]);
  return { OR: codes };
}
