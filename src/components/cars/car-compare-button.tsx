"use client";

import { GitCompare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCarCompareOptional } from "@/components/cars/car-compare-context";
import { toCarCompareEntry, type CarCompareEntry } from "@/lib/car-compare";
import { cn } from "@/lib/utils";

type Props = {
  car: CarCompareEntry | Parameters<typeof toCarCompareEntry>[0];
  className?: string;
  variant?: "card" | "detail";
};

const cardBtn =
  "inline-flex h-11 min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background/80 px-3 text-xs font-semibold text-foreground transition duration-250 ease-out hover:-translate-y-px hover:border-[var(--brand)]/35 hover:bg-muted/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60 dark:border-[#2A313C] dark:bg-[#181C22]/80 dark:text-[#B7C0CC] dark:hover:bg-white/[0.06] group-hover/card:brightness-105";

const detailBtn =
  "inline-flex h-8 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15";

export function CarCompareButton({ car, className, variant = "card" }: Props) {
  const compare = useCarCompareOptional();
  const router = useRouter();
  const entry = "id" in car && "slug" in car && "title" in car ? (car as CarCompareEntry) : toCarCompareEntry(car);
  const selected = compare?.isSelected(entry.id) ?? false;

  function onClick() {
    if (!compare) {
      router.push(`/cars/${entry.slug}`);
      return;
    }
    const result = compare.toggle(entry);
    if (!result.ok && result.reason === "full") {
      toast.error("Compare list is full. Remove a vehicle first, then add this one.");
      return;
    }
    if (result.action === "added") {
      if (result.list.length >= compare.max) {
        toast.success("Both vehicles selected. Open Compare to view side by side.");
      } else {
        toast.success("Added to compare. Select one more vehicle.");
      }
      return;
    }
    toast.message("Removed from compare.");
  }

  return (
    <button
      type="button"
      aria-label={selected ? `Remove ${entry.title} from compare` : `Add ${entry.title} to compare`}
      aria-pressed={selected}
      title={selected ? "Remove from compare" : "Add to compare (pick 2 vehicles)"}
      className={cn(
        variant === "card" ? cardBtn : detailBtn,
        selected &&
          "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-[var(--brand)] hover:border-[var(--brand)]/60 dark:text-[var(--brand)]",
        className,
      )}
      onClick={onClick}
    >
      <GitCompare className="size-4 shrink-0" aria-hidden />
      <span className={variant === "detail" ? "hidden sm:inline" : undefined}>
        {selected ? "In compare" : "Compare"}
      </span>
    </button>
  );
}
