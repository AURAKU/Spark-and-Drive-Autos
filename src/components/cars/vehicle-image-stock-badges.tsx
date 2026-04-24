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
      className={className ?? "pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2"}
    >
      <Badge
        variant="secondary"
        title={sourceLabel[car.sourceType] ?? car.sourceType}
        className="pointer-events-auto bg-black/50 text-[10px] text-white uppercase backdrop-blur"
      >
        {sourceLabel[car.sourceType] ?? car.sourceType}
      </Badge>
      {stock.variant === "sold" ? (
        <span
          role="status"
          title={SOLD_AFTER_PAYMENT_HINT}
          aria-label={SOLD_AFTER_PAYMENT_HINT}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-md border-2 border-red-600 bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 shadow-md dark:bg-zinc-950/95 dark:text-red-500"
        >
          <CircleCheck className="size-3.5 shrink-0 text-red-600 dark:text-red-500" strokeWidth={2.75} aria-hidden />
          {stock.label}
        </span>
      ) : stock.variant === "reserved" ? (
        <Badge
          variant="outline"
          title="Reserved by a buyer completing payment."
          className="pointer-events-auto border-amber-400/45 bg-amber-500/25 text-[10px] font-semibold uppercase text-amber-50 backdrop-blur"
        >
          {stock.label}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          title="Available for purchase on this listing when checkout is open."
          className="pointer-events-auto border-white/20 bg-black/40 text-[10px] text-white backdrop-blur"
        >
          {stock.label}
        </Badge>
      )}
    </div>
  );
}
