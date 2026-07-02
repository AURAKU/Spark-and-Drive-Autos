import type { EngineType } from "@prisma/client";
import { Calendar, Car, Fuel, Gauge, Zap } from "lucide-react";

import { engineTypeLabel } from "@/lib/engine-type-ui";
import { cn } from "@/lib/utils";

type Props = {
  year: number;
  engineType: EngineType;
  transmission?: string | null;
  mileage?: number | null;
  className?: string;
};

function fuelIcon(engineType: EngineType) {
  if (engineType === "ELECTRIC") return Zap;
  if (engineType === "HYBRID" || engineType === "PLUGIN_HYBRID") return Fuel;
  return Fuel;
}

function fuelShortLabel(engineType: EngineType): string {
  switch (engineType) {
    case "GASOLINE_PETROL":
      return "Petrol";
    case "GASOLINE_DIESEL":
      return "Diesel";
    case "ELECTRIC":
      return "Electric";
    case "HYBRID":
      return "Hybrid";
    case "PLUGIN_HYBRID":
      return "Plug-in hybrid";
    default:
      return engineTypeLabel(engineType);
  }
}

function transmissionShortLabel(raw?: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.includes("auto")) return "Automatic";
  if (lower.includes("manual")) return "Manual";
  if (lower.includes("cvt")) return "CVT";
  if (lower.includes("dct") || lower.includes("dual")) return "Dual-clutch";
  return t.length > 18 ? `${t.slice(0, 16)}…` : t;
}

function formatMileage(km?: number | null): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  return `${km.toLocaleString("en-US")} km`;
}

const chipClass =
  "inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60 dark:bg-white/[0.06] dark:text-[#B7C0CC] dark:ring-[#2A313C]";

export function CarSpecChips({ year, engineType, transmission, mileage, className }: Props) {
  const FuelIcon = fuelIcon(engineType);
  const trans = transmissionShortLabel(transmission);
  const mileageLabel = formatMileage(mileage);

  const chips: Array<{ key: string; icon: typeof Car; label: string }> = [];
  if (trans) chips.push({ key: "trans", icon: Car, label: trans });
  chips.push({ key: "fuel", icon: FuelIcon, label: fuelShortLabel(engineType) });
  if (mileageLabel) chips.push({ key: "mileage", icon: Gauge, label: mileageLabel });
  chips.push({ key: "year", icon: Calendar, label: String(year) });

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Vehicle specifications">
      {chips.map(({ key, icon: Icon, label }) => (
        <li key={key}>
          <span className={chipClass}>
            <Icon className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
