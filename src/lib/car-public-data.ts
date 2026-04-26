import type { Prisma } from "@prisma/client";

/**
 * Scalars for public vehicle pages — excludes admin cost and supplier/dealer trace fields.
 */
const publicCarScalars: Prisma.CarSelect = {
  id: true,
  slug: true,
  title: true,
  brand: true,
  model: true,
  year: true,
  trim: true,
  bodyType: true,
  engineType: true,
  transmission: true,
  drivetrain: true,
  mileage: true,
  colorExterior: true,
  colorInterior: true,
  vin: true,
  condition: true,
  engineDetails: true,
  sourceType: true,
  availabilityStatus: true,
  inspectionStatus: true,
  estimatedDelivery: true,
  seaShippingFeeGhs: true,
  basePriceRmb: true,
  price: true,
  currency: true,
  location: true,
  featured: true,
  listingState: true,
  tags: true,
  shortDescription: true,
  longDescription: true,
  specifications: true,
  accidentHistory: true,
  coverImageUrl: true,
  coverImagePublicId: true,
  createdAt: true,
  updatedAt: true,
};

export const publicCarInventoryArgs = (where: Prisma.CarWhereInput, skip: number, take: number) =>
  ({
    where,
    orderBy: [{ featured: "desc" as const }, { listingState: "asc" as const }, { updatedAt: "desc" as const }],
    skip,
    take,
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
  }) satisfies Prisma.CarFindManyArgs;

/**
 * Public vehicle detail (slug page): customer-facing data + media only.
 */
export const publicCarDetailBySlug = (slug: string) =>
  ({
    where: { slug, listingState: { in: ["PUBLISHED", "SOLD"] } },
    select: {
      ...publicCarScalars,
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] },
      specs: { orderBy: { sortOrder: "asc" } },
    },
  }) satisfies Prisma.CarFindFirstArgs;
