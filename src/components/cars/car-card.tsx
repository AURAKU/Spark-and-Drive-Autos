import Image from "next/image";
import Link from "next/link";

import type { Car } from "@prisma/client";
import { CarListingState } from "@prisma/client";

import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
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

const sourceLabel: Record<string, string> = {
  IN_GHANA: "Ghana stock",
  IN_CHINA: "China source",
  IN_TRANSIT: "In transit",
};

export function CarCard({ car, displayAmount, displayCurrency }: CarCardProps) {
  const href = `/cars/${car.slug}`;
  const isSold = car.listingState === CarListingState.SOLD;

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
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {isSold && (
              <Badge className="border-red-500/60 bg-red-600/90 text-[10px] font-semibold text-white uppercase backdrop-blur">
                Sold
              </Badge>
            )}
            <Badge variant="secondary" className="bg-black/50 text-[10px] text-white uppercase backdrop-blur">
              {sourceLabel[car.sourceType] ?? car.sourceType}
            </Badge>
            <Badge variant="outline" className="border-white/20 bg-black/40 text-[10px] text-white backdrop-blur">
              {car.availabilityStatus.replaceAll("_", " ")}
            </Badge>
          </div>
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
        </div>
      </Card>
    </Link>
  );
}
