"use client";

import { GitCompare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCarCompareOptional } from "@/components/cars/car-compare-context";
import { buildComparePageHref, toCarCompareEntry, type CarCompareEntry } from "@/lib/car-compare";
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
  const canViewCompare = selected && Boolean(compare?.compareHref);

  function openCompareView(href: string) {
    toast.success("Opening side-by-side comparison…");
    router.push(href);
  }

  function onClick() {
    if (!compare) {
      router.push(`/cars/${entry.slug}`);
      return;
    }

    if (canViewCompare && compare.compareHref) {
      openCompareView(compare.compareHref);
      return;
    }

    const result = compare.toggle(entry);
    if (!result.ok && result.reason === "full") {
      toast.error("Compare list is full. Remove a vehicle from the compare tray first.");
      return;
    }

    if (result.action === "added") {
      if (result.list.length >= compare.max) {
        openCompareView(buildComparePageHref([result.list[0]!.slug, result.list[1]!.slug]));
      } else {
        toast.success("Added to compare. Select one more vehicle to view side by side.");
      }
      return;
    }

    toast.message("Removed from compare.");
  }

  const label = canViewCompare ? "View compare" : selected ? "In compare" : "Compare";

  return (
    <button
      type="button"
      aria-label={
        canViewCompare
          ? `View side-by-side comparison including ${entry.title}`
          : selected
            ? `Remove ${entry.title} from compare`
            : `Add ${entry.title} to compare`
      }
      aria-pressed={selected}
      title={
        canViewCompare
          ? "Open side-by-side comparison"
          : selected
            ? "View comparison or remove from compare tray"
            : "Add to compare (pick 2 vehicles)"
      }
      className={cn(
        variant === "card" ? cardBtn : detailBtn,
        selected &&
          "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-[var(--brand)] hover:border-[var(--brand)]/60 dark:text-[var(--brand)]",
        canViewCompare &&
          "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)] shadow-sm hover:border-[var(--brand)] dark:text-[var(--brand)]",
        className,
      )}
      onClick={onClick}
    >
      <GitCompare className="size-4 shrink-0" aria-hidden />
      <span className={variant === "detail" ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  );
}
