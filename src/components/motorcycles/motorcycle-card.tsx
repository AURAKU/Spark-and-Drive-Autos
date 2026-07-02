import Link from "next/link";
import { CirclePlay } from "lucide-react";

import type { Motorcycle } from "@prisma/client";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import { Card } from "@/components/ui/card";
import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";

type MotorcycleCardProps = {
  motorcycle: Pick<
    Motorcycle,
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
    | "motorcycleType"
  >;
  displayAmount: number;
  displayCurrency: DisplayCurrency;
  reservationDepositHint?: string | null;
  videoTeaser?: { posterUrl: string } | null;
};

export function MotorcycleCard({
  motorcycle,
  displayAmount,
  displayCurrency,
  reservationDepositHint,
  videoTeaser,
}: MotorcycleCardProps) {
  const href = `/motorcycles/${motorcycle.slug}`;
  return (
    <Card className="overflow-hidden border-border bg-card transition hover:border-[var(--brand)]/40 hover:shadow-[0_0_40px_-12px_rgba(20,216,230,0.45)] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted dark:bg-zinc-900">
        <Link href={href} className="relative block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
          {motorcycle.coverImageUrl ? (
            <VehicleCoverImage
              src={motorcycle.coverImageUrl}
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
            href={`${href}#walkthrough`}
            className="absolute bottom-2 right-2 z-20 w-[32%] max-w-[6.5rem] overflow-hidden rounded-lg border-2 border-white/25 shadow-lg"
            aria-label="Watch video walkthrough"
          >
            <div className="relative aspect-video w-full bg-black/50">
              <VehicleCoverImage src={videoTeaser.posterUrl} alt="" fill className="object-cover" deliveryPreset="tableThumb" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <CirclePlay className="h-6 w-6 text-white" />
              </span>
            </div>
          </Link>
        ) : null}
        <VehicleImageStockBadges car={motorcycle} />
      </div>
      <div className="space-y-1 p-4">
        <Link href={href} className="block">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground hover:text-[var(--brand)]">{motorcycle.title}</h3>
        </Link>
        <p className="text-xs text-muted-foreground">
          {motorcycle.motorcycleType.replace(/_/g, " ")} · {motorcycle.year}
        </p>
        <p className="text-base font-bold text-foreground">
          {formatConverted(displayAmount, displayCurrency)}
        </p>
        {reservationDepositHint ? (
          <p className="text-[11px] text-muted-foreground">{reservationDepositHint}</p>
        ) : null}
      </div>
    </Card>
  );
}
