import {
  CircleCheck,
  Clock3,
  Globe2,
  MapPin,
  Package,
  Ship,
  Truck,
} from "lucide-react";

import type { Car, SourceType } from "@prisma/client";

import { getVehicleStockBadgeForDisplay, type VehicleStockBadgeVariant } from "@/lib/car-stock-badge";
import { cn } from "@/lib/utils";

const SOLD_AFTER_PAYMENT_HINT =
  "Purchased — this vehicle is marked Sold automatically in our system after a successful full payment. It is no longer available for checkout.";

type CarPick = Pick<Car, "sourceType" | "listingState" | "availabilityStatus">;

const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; icon: typeof MapPin; className: string }
> = {
  IN_GHANA: {
    label: "Ghana Stock",
    icon: MapPin,
    className:
      "bg-[#FFD54F] text-white border-white/15 dark:bg-[#F4B400] dark:text-white",
  },
  IN_CHINA: {
    label: "China Source",
    icon: Globe2,
    className:
      "bg-[#E63946] text-white border-white/15 dark:bg-[#C1121F] dark:text-white",
  },
  IN_TRANSIT: {
    label: "In Transit",
    icon: Ship,
    className:
      "bg-blue-600/90 text-white border-white/15 dark:bg-blue-600 dark:text-white",
  },
};

const STATUS_CONFIG: Record<
  VehicleStockBadgeVariant,
  { icon: typeof CircleCheck; className: string; title?: string }
> = {
  available: {
    icon: CircleCheck,
    className:
      "bg-emerald-600 text-white border-white/15 dark:bg-emerald-600/95 dark:text-white",
    title: "Available for purchase on this listing when checkout is open.",
  },
  reserved: {
    icon: Clock3,
    className:
      "bg-orange-500 text-white border-white/15 dark:bg-orange-500/95 dark:text-white",
    title: "Reserved by a buyer completing payment.",
  },
  sold: {
    icon: CircleCheck,
    className:
      "bg-zinc-500 text-white border-white/15 dark:bg-zinc-600 dark:text-white",
    title: SOLD_AFTER_PAYMENT_HINT,
  },
  in_transit: {
    icon: Truck,
    className:
      "bg-blue-600 text-white border-white/15 dark:bg-blue-600/95 dark:text-white",
    title: "Vehicle is currently in transit.",
  },
  shipping: {
    icon: Ship,
    className:
      "bg-violet-600 text-white border-white/15 dark:bg-violet-600/95 dark:text-white",
    title: "Vehicle is being prepared for shipping.",
  },
  processing: {
    icon: Package,
    className:
      "bg-teal-600 text-white border-white/15 dark:bg-teal-600/95 dark:text-white",
    title: "Listing is being processed.",
  },
};

const pillBase =
  "inline-flex h-[32px] max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.3px] shadow-sm backdrop-blur-sm";

function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  const config = SOURCE_CONFIG[sourceType] ?? {
    label: sourceType.replaceAll("_", " "),
    icon: Globe2,
    className: "bg-black/70 text-white border-white/15",
  };
  const Icon = config.icon;

  return (
    <span
      role="status"
      title={config.label}
      aria-label={config.label}
      className={cn(pillBase, "pointer-events-auto", config.className)}
    >
      <Icon className="size-3.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{config.label}</span>
    </span>
  );
}

function StatusBadge({ stock }: { stock: ReturnType<typeof getVehicleStockBadgeForDisplay> }) {
  const config = STATUS_CONFIG[stock.variant];
  const Icon = config.icon;
  const title = stock.variant === "sold" ? SOLD_AFTER_PAYMENT_HINT : config.title;

  return (
    <span
      role="status"
      title={title}
      aria-label={stock.variant === "sold" ? SOLD_AFTER_PAYMENT_HINT : `${stock.label}. ${config.title ?? ""}`}
      className={cn(pillBase, "pointer-events-auto", config.className)}
    >
      <Icon className="size-3.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{stock.label}</span>
    </span>
  );
}

/** Premium source (top-left) + status (top-right) pills on vehicle imagery. */
export function VehicleImageStockBadges({ car, className }: { car: CarPick; className?: string }) {
  const stock = getVehicleStockBadgeForDisplay(car);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3",
        className,
      )}
    >
      <div className="min-w-0 max-w-[calc(50%-0.375rem)] shrink">
        <SourceBadge sourceType={car.sourceType} />
      </div>
      <div className="min-w-0 max-w-[calc(50%-0.375rem)] shrink text-right">
        <StatusBadge stock={stock} />
      </div>
    </div>
  );
}
