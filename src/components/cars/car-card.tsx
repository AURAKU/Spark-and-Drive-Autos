"use client";

import { memo } from "react";
import Link from "next/link";
import { CirclePlay, MapPin } from "lucide-react";

import type { Car, EngineType } from "@prisma/client";

import { CarCardSecondaryActions } from "@/components/cars/car-card-secondary-actions";
import { CarSpecChips } from "@/components/cars/car-spec-chips";
import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";
import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";
import { cn } from "@/lib/utils";

type CarCardProps = {
  car: Pick<
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
  > & {
    engineType: EngineType;
    transmission?: string | null;
    mileage?: number | null;
  };
  displayAmount: number;
  displayCurrency: DisplayCurrency;
  shareUrl: string;
  isSignedIn?: boolean;
  initialFavorite?: boolean;
  /** e.g. “10% dep. · ₵12,000” when online reserve is available */
  reservationDepositHint?: string | null;
  /** Video walkthrough poster — links to listing anchor; no video element on grid. */
  videoTeaser?: { posterUrl: string } | null;
};

function formatLocationLabel(location?: string | null, sourceType?: Car["sourceType"]): string {
  const trimmed = location?.trim();
  if (trimmed) return trimmed;
  if (sourceType === "IN_GHANA") return "Accra, Ghana";
  if (sourceType === "IN_CHINA") return "Guangzhou, China";
  return "—";
}

export const CarCard = memo(function CarCard({
  car,
  displayAmount,
  displayCurrency,
  shareUrl,
  isSignedIn = false,
  initialFavorite = false,
  reservationDepositHint,
  videoTeaser,
}: CarCardProps) {
  const href = `/cars/${car.slug}`;
  const stock = getVehicleStockBadgeForDisplay(car);
  const isSold = stock.variant === "sold";
  const locationLabel = formatLocationLabel(car.location, car.sourceType);

  return (
    <article
      className={cn(
        "group/card premium-vehicle-card flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-250 ease-out",
        "border-[#E5E7EB] hover:-translate-y-0.5 hover:shadow-lg dark:border-[#2A313C] dark:bg-[#181C22] dark:shadow-black/20",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-muted shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)] dark:bg-zinc-900">
        <Link
          href={href}
          className="relative block h-full w-full overflow-hidden rounded-t-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {car.coverImageUrl ? (
            <VehicleCoverImage
              src={car.coverImageUrl}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 33vw"
              className="object-cover transition duration-250 ease-out md:group-hover/card:scale-[1.03]"
              deliveryPreset="card"
              imagePlaceholder
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              Image unavailable
            </div>
          )}
        </Link>
        {videoTeaser ? (
          <Link
            href={`${href}#vehicle-walkthrough`}
            className="absolute bottom-3 right-3 z-20 w-[32%] max-w-[6.5rem] overflow-hidden rounded-xl border-2 border-white/25 shadow-lg outline-none ring-offset-2 ring-offset-background transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            aria-label="Watch video walkthrough"
          >
            <div className="relative aspect-video w-full bg-black/50">
              <VehicleCoverImage
                src={videoTeaser.posterUrl}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                deliveryPreset="galleryStrip"
                imagePlaceholder
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <CirclePlay className="size-8 text-white drop-shadow-md" strokeWidth={1.25} aria-hidden />
              </span>
            </div>
          </Link>
        ) : null}
        <VehicleImageStockBadges car={car} />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase dark:text-[#B7C0CC]">
            {car.brand} · {car.year}
          </p>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-foreground dark:text-white">
            <Link href={href} className="outline-none hover:text-[var(--brand)] focus-visible:underline">
              {car.title}
            </Link>
          </h3>
        </div>

        <div className="space-y-1">
          <p className="relative inline-block text-2xl font-bold tracking-tight text-foreground dark:text-white">
            {formatConverted(displayAmount, displayCurrency)}
            <span
              className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-gradient-to-r from-[var(--brand)]/80 via-[var(--brand)]/40 to-transparent"
              aria-hidden
            />
          </p>
        </div>

        <CarSpecChips
          year={car.year}
          engineType={car.engineType}
          transmission={car.transmission}
          mileage={car.mileage}
        />

        <p className="flex items-start gap-1.5 text-sm text-muted-foreground dark:text-[#B7C0CC]">
          <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
          <span>{locationLabel}</span>
        </p>

        {isSold ? (
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Not available — sold
          </p>
        ) : reservationDepositHint ? (
          <p className="text-xs text-muted-foreground dark:text-[#B7C0CC]">Reserve: {reservationDepositHint}</p>
        ) : null}

        <div className="mt-auto space-y-3 pt-1">
          <Link
            href={href}
            className={cn(
              "inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-black shadow-sm transition duration-250 ease-out",
              "bg-gradient-to-r from-[var(--brand)] to-[#0ea5b7] hover:-translate-y-px hover:shadow-[0_8px_24px_-8px_rgba(20,216,230,0.55)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-reduce:hover:translate-y-0",
            )}
          >
            View Details
          </Link>
          <CarCardSecondaryActions
            carId={car.id}
            carSlug={car.slug}
            carTitle={car.title}
            shareUrl={shareUrl}
            isSignedIn={isSignedIn}
            initialFavorite={initialFavorite}
          />
        </div>
      </div>
    </article>
  );
});

CarCard.displayName = "CarCard";
