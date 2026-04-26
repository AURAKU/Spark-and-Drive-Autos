"use client";

import type { ShipmentLogisticsStage } from "@prisma/client";

import {
  GHANA_PARTS_FLOW_LABELS,
  getGhanaPartsFlowState,
} from "@/lib/shipping/ghana-parts-flow";
import { SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { cn } from "@/lib/utils";

/**
 * Six-step happy path for **Parts · Ghana** (local stock) — matches ops milestones customers see in-app.
 */
export function GhanaPartsShipmentFlowVisual({
  currentStage,
  compact = false,
}: {
  currentStage: ShipmentLogisticsStage;
  compact?: boolean;
}) {
  const state = getGhanaPartsFlowState(currentStage);

  if (state.isException) {
    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-xs font-medium",
          currentStage === "DELAYED"
            ? "border-amber-700/40 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            : "border-red-700/40 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
        )}
      >
        {SHIPMENT_STAGE_LABEL[currentStage]}
      </div>
    );
  }

  return (
    <div className={cn("w-full", compact ? "max-w-xl" : "max-w-3xl")}>
      <div className="relative flex items-start justify-between gap-0.5 sm:gap-1">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[11px] h-px bg-gradient-to-r from-border via-[var(--brand)]/45 to-border dark:from-white/5 dark:via-[var(--brand)]/40 dark:to-white/5"
          aria-hidden
        />
        {GHANA_PARTS_FLOW_LABELS.map((label, i) => {
          const done = state.allComplete || state.activeIndex > i;
          const active = !state.allComplete && state.activeIndex === i;
          const sub =
            active && i === 5 && state.lastStepSubLabel ? (
              <span className="mt-0.5 block text-[8px] font-normal normal-case text-muted-foreground dark:text-zinc-500">
                {state.lastStepSubLabel}
              </span>
            ) : null;
          return (
            <div key={label} className="relative z-[1] flex min-w-0 flex-1 flex-col items-center text-center">
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
              <div
                className={cn(
                  "mt-1.5 min-h-[2.5rem] text-[9px] font-medium leading-tight",
                  active
                    ? "text-foreground dark:text-white"
                    : done
                      ? "text-muted-foreground dark:text-zinc-400"
                      : "text-muted-foreground dark:text-zinc-600",
                )}
              >
                <p className="line-clamp-2">{label}</p>
                {sub}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
