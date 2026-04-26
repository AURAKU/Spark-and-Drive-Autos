import { CircleCheck } from "lucide-react";

import type { Car } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";

const sourceLabel: Record<string, string> = {
  IN_GHANA: "Ghana stock",
  IN_CHINA: "China source",
  IN_TRANSIT: "In transit",
};

const SOLD_AFTER_PAYMENT_HINT =
  "Purchased — this vehicle is marked Sold automatically in our system after a successful full payment. It is no longer available for checkout.";

type CarPick = Pick<Car, "sourceType" | "listingState" | "availabilityStatus">;

/** Ghana / China (or transit) + stock chip — Sold replaces Available when payment syncs inventory. */
export function VehicleImageStockBadges({ car, className }: { car: CarPick; className?: string }) {
  const stock = getVehicleStockBadgeForDisplay(car);

  return (
    <div
      className={
        className ??
        "pointer-events-none absolute left-2.5 top-2.5 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1.5"
      }
    >
      <Badge
        variant="secondary"
        title={sourceLabel[car.sourceType] ?? car.sourceType}
        className="pointer-events-auto max-w-full whitespace-normal break-words bg-black/70 px-2 py-1 text-[10px] leading-tight text-white uppercase backdrop-blur"
      >
        {sourceLabel[car.sourceType] ?? car.sourceType}
      </Badge>
      {stock.variant === "sold" ? (
        <span
          role="status"
          title={SOLD_AFTER_PAYMENT_HINT}
          aria-label={SOLD_AFTER_PAYMENT_HINT}
          className="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-md border-2 border-red-600 bg-white/95 px-2 py-1 text-[10px] leading-tight font-bold uppercase tracking-wide text-red-600 shadow-md dark:bg-zinc-950/95 dark:text-red-500"
        >
          <CircleCheck className="size-3.5 shrink-0 text-red-600 dark:text-red-500" strokeWidth={2.75} aria-hidden />
          <span className="whitespace-normal break-words">{stock.label}</span>
        </span>
      ) : stock.variant === "reserved" ? (
        <Badge
          variant="outline"
          title="Reserved by a buyer completing payment."
          className="pointer-events-auto max-w-full whitespace-normal break-words border-amber-400/45 bg-amber-500/25 px-2 py-1 text-[10px] leading-tight font-semibold uppercase text-amber-50 backdrop-blur"
        >
          {stock.label}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          title="Available for purchase on this listing when checkout is open."
          className="pointer-events-auto max-w-full whitespace-normal break-words border border-emerald-500/70 bg-emerald-600/90 px-2 py-1 text-[10px] leading-tight font-semibold uppercase text-white backdrop-blur dark:border-emerald-400/80 dark:bg-emerald-500/35 dark:text-emerald-100"
        >
          {stock.label}
        </Badge>
      )}
    </div>
  );
}
