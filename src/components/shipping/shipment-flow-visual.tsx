"use client";

import type { ShipmentLogisticsStage } from "@prisma/client";

import { SHIPMENT_STAGE_FLOW, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { cn } from "@/lib/utils";

export function ShipmentFlowVisual({
  currentStage,
  compact = false,
}: {
  currentStage: ShipmentLogisticsStage;
  compact?: boolean;
}) {
  const isException = currentStage === "DELAYED" || currentStage === "CANCELLED";
  const activeIndex = SHIPMENT_STAGE_FLOW.indexOf(currentStage);
  const offHappyPath = !isException && activeIndex < 0;

  return (
    <div className={cn("w-full", compact ? "max-w-xl" : "max-w-3xl")}>
      {offHappyPath ? (
        <div className="mb-3 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-foreground dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-300">
          Logistics stage: {SHIPMENT_STAGE_LABEL[currentStage]}
        </div>
      ) : null}
      {isException ? (
        <div
          className={cn(
            "mb-3 rounded-xl border px-3 py-2 text-xs font-medium",
            currentStage === "DELAYED"
              ? "border-amber-700/40 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              : "border-red-700/40 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
          )}
        >
          {SHIPMENT_STAGE_LABEL[currentStage]}
        </div>
      ) : null}
      <div className="relative flex items-start justify-between gap-1">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[11px] h-px bg-gradient-to-r from-border via-[var(--brand)]/45 to-border dark:from-white/5 dark:via-[var(--brand)]/40 dark:to-white/5"
          aria-hidden
        />
        {SHIPMENT_STAGE_FLOW.map((stage, i) => {
          const done = !isException && !offHappyPath && activeIndex > i;
          const active = !isException && !offHappyPath && activeIndex === i;
          return (
            <div key={stage} className="relative z-[1] flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  done
                    ? "border-[var(--brand)]/70 bg-[var(--brand)]/20 text-[var(--brand)] dark:border-[var(--brand)]/60 dark:bg-[var(--brand)]/25"
                    : active
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/15 text-foreground shadow-[0_0_16px_-4px_color-mix(in_srgb,var(--brand)_45%,transparent)] dark:border-white/40 dark:bg-white/15 dark:text-white dark:shadow-[0_0_20px_-4px_var(--brand)]"
                      : "border-border bg-muted text-muted-foreground dark:border-white/10 dark:bg-black/40 dark:text-zinc-500",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <p
                className={cn(
                  "mt-1.5 line-clamp-2 text-[9px] font-medium uppercase tracking-wide",
                  active
                    ? "text-foreground dark:text-white"
                    : done
                      ? "text-muted-foreground dark:text-zinc-400"
                      : "text-muted-foreground dark:text-zinc-600",
                )}
              >
                {SHIPMENT_STAGE_LABEL[stage]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
