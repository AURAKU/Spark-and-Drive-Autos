"use client";

import { GitCompare, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CarComparePickerSheet } from "@/components/cars/car-compare-picker-sheet";
import { useCarCompare } from "@/components/cars/car-compare-context";
import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { cn } from "@/lib/utils";

export function CarCompareBar() {
  const { entries, remove, clear, compareHref, ready, max } = useCarCompare();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!ready || entries.length === 0) return null;

  const slots = Array.from({ length: max }, (_, i) => entries[i] ?? null);
  const needsSecondVehicle = entries.length < max;

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.25)] backdrop-blur-md dark:border-white/10 dark:bg-[#12151a]/95"
        role="region"
        aria-label="Vehicle compare tray"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <GitCompare className="size-3.5" aria-hidden />
              Compare ({entries.length}/{max})
            </p>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {slots.map((entry, idx) =>
                entry ? (
                  <div
                    key={entry.id}
                    className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {entry.coverImageUrl ? (
                        <VehicleCoverImage
                          src={entry.coverImageUrl}
                          alt=""
                          fill
                          sizes="40px"
                          deliveryPreset="card"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[9px] text-muted-foreground">No img</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{entry.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {entry.brand} · {entry.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${entry.title} from compare`}
                      onClick={() => remove(entry.id)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    key={`empty-${idx}`}
                    type="button"
                    className="flex min-h-[52px] min-w-[8rem] flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/[0.04] px-3 text-xs font-medium text-[var(--brand)] transition hover:border-[var(--brand)]/60 hover:bg-[var(--brand)]/[0.08]"
                    onClick={() => setPickerOpen(true)}
                  >
                    Select vehicle {idx + 1}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted dark:border-white/15"
              onClick={clear}
            >
              Clear
            </button>
            {compareHref ? (
              <Link
                href={compareHref}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-black shadow-sm transition",
                  "bg-gradient-to-r from-[var(--brand)] to-[#0ea5b7] hover:opacity-95",
                )}
              >
                <GitCompare className="size-3.5" aria-hidden />
                View side by side
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/15"
                onClick={() => setPickerOpen(true)}
              >
                Pick {max - entries.length} more
              </button>
            )}
            {!needsSecondVehicle ? null : (
              <Link
                href="/inventory"
                className="inline-flex h-9 items-center justify-center px-2 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Browse cars
              </Link>
            )}
          </div>
        </div>
      </div>
      <CarComparePickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}
