import Link from "next/link";
import { CirclePlay } from "lucide-react";

import type { Car } from "@prisma/client";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import { Card } from "@/components/ui/card";
import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";
import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";

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
  >;
  displayAmount: number;
  displayCurrency: DisplayCurrency;
  /** e.g. “10% dep. · ₵12,000” when online reserve is available */
  reservationDepositHint?: string | null;
  /** Video walkthrough poster — links to listing anchor; no video element on grid. */
  videoTeaser?: { posterUrl: string } | null;
};

export function CarCard({
  car,
  displayAmount,
  displayCurrency,
  reservationDepositHint,
  videoTeaser,
}: CarCardProps) {
  const href = `/cars/${car.slug}`;
  const stock = getVehicleStockBadgeForDisplay(car);
  const isSold = stock.variant === "sold";

  return (
    <Card className="overflow-hidden border-border bg-card transition hover:border-[var(--brand)]/40 hover:shadow-[0_0_40px_-12px_rgba(20,216,230,0.45)] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted dark:bg-zinc-900">
        <Link
          href={href}
          className="relative block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {car.coverImageUrl ? (
            <VehicleCoverImage
              src={car.coverImageUrl}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 33vw"
              className="object-cover transition duration-500 hover:scale-[1.03]"
              deliveryPreset="card"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
              Image unavailable
            </div>
          )}
        </Link>
        {videoTeaser ? (
          <Link
            href={`${href}#vehicle-walkthrough`}
            className="absolute bottom-2 right-2 z-20 w-[32%] max-w-[6.5rem] overflow-hidden rounded-lg border-2 border-white/25 shadow-lg outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
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
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <CirclePlay className="size-8 text-white drop-shadow-md" strokeWidth={1.25} aria-hidden />
              </span>
            </div>
          </Link>
        ) : null}
        <VehicleImageStockBadges car={car} />
      </div>
      <Link
        href={href}
        className="group block space-y-2 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-inset"
      >
        <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {car.brand} · {car.year}
        </p>
        <h3 className="line-clamp-2 text-base font-semibold text-foreground group-hover:text-[var(--brand)] dark:text-white">
          {car.title}
        </h3>
        <p className="text-sm text-muted-foreground">{car.location?.trim() ? car.location : "—"}</p>
        <p className="text-lg font-semibold text-[var(--brand)]">
          {formatConverted(displayAmount, displayCurrency)}
        </p>
        {isSold ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-500">
            Not available — sold
          </p>
        ) : reservationDepositHint ? (
          <p className="text-xs text-muted-foreground">Reserve: {reservationDepositHint}</p>
        ) : null}
      </Link>
    </Card>
  );
}
