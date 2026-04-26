import type { Prisma } from "@prisma/client";

/**
 * Part fields that must never be loaded on public routes (admin / internal only).
 * Pair with `publicPart*Select` on storefront and customer-facing APIs.
 */
export const partAdminOnlyKeys = [
  "supplierCostRmb",
  "supplierDistributorRef",
  "supplierDistributorPhone",
] as const;

/** Catalog / list: scalars only — no supplier cost or distributor trace. */
export const publicPartListSelect: Prisma.PartSelect = {
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
  metaJson: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Part detail: public scalars + gallery + delivery options — excludes admin cost / supplier ref.
 */
export const publicPartDetailSelect = {
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
  metaJson: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
  description: true,
  categoryId: true,
  sku: true,
  stockStatusLocked: true,
  listingState: true,
  tags: true,
  coverImagePublicId: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  deliveryOptions: {
    where: { enabled: true },
    orderBy: { createdAt: "asc" as const },
    include: { template: true },
  },
} satisfies Prisma.PartSelect;
