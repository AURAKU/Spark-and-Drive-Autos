/** Shared Prisma select for storefront vehicle cards (inventory + spotlight). */
export const STOREFRONT_CAR_CARD_SELECT = {
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
  engineType: true,
  transmission: true,
  mileage: true,
} as const;
