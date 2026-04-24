import Image from "next/image";
import Link from "next/link";

import type { Car } from "@prisma/client";

import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";
import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";
import { Card } from "@/components/ui/card";

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
};

export function CarCard({ car, displayAmount, displayCurrency }: CarCardProps) {
  const href = `/cars/${car.slug}`;
  const stock = getVehicleStockBadgeForDisplay(car);
  const isSold = stock.variant === "sold";

  return (
    <Link href={href} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
      <Card className="overflow-hidden border-border bg-card transition hover:border-[var(--brand)]/40 hover:shadow-[0_0_40px_-12px_rgba(20,216,230,0.45)] dark:border-white/10 dark:bg-white/[0.03]">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted dark:bg-zinc-900">
          {car.coverImageUrl ? (
            <Image
              src={car.coverImageUrl}
              alt={car.title}
              fill
              sizes="(max-width:768px) 100vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No cover image</div>
          )}
          <VehicleImageStockBadges car={car} />
        </div>
        <div className="space-y-2 p-4">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            {car.brand} · {car.year}
          </p>
          <h3 className="line-clamp-2 text-base font-semibold text-foreground dark:text-white">{car.title}</h3>
          <p className="text-sm text-muted-foreground">{car.location}</p>
          <p className="text-lg font-semibold text-[var(--brand)]">
            {formatConverted(displayAmount, displayCurrency)}
          </p>
          {isSold ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-500">
              Not available — sold
            </p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
