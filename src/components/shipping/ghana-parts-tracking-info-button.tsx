"use client";

import { GhanaPartsShipmentFlowVisual } from "@/components/shipping/ghana-parts-shipment-flow-visual";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GHANA_PARTS_FLOW_LABELS } from "@/lib/shipping/ghana-parts-flow";
import { cn } from "@/lib/utils";

type Props = {
  /** e.g. "customer" | "admin" for minor copy tweaks */
  variant?: "customer" | "admin";
  className?: string;
};

/**
 * Opens a reference dialog for the Ghana-stock parts & accessories delivery ladder (6 milestones).
 */
export function GhanaPartsTrackingInfoButton({ variant = "customer", className }: Props) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "inline-flex min-h-10 w-full max-w-md items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition hover:border-[var(--brand)]/40 hover:bg-muted/50 sm:w-auto dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
          className,
        )}
        aria-label="Open Ghana stock parts and accessories delivery tracking reference"
      >
        Delivery tracking — Ghana stock (parts &amp; accessories)
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] max-w-lg overflow-y-auto border-border bg-card sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Ghana stock · parts &amp; accessories delivery</DialogTitle>
          <DialogDescription className="sr-only">
            Reference for Ghana local stock parts and accessories delivery milestones.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p>
            Orders fulfilled from <span className="text-foreground/90">local Ghana inventory</span> follow the milestones
            below. Your live order card shows the current step; operations advance stages as the package moves.
          </p>
          {variant === "admin" ? (
            <p className="text-amber-200/90">
              In <span className="font-mono">Shipping &amp; fulfilment</span>, use the same stage controls —{" "}
              <strong className="text-amber-100">Parts · Ghana</strong> rows use this 6-step rail in the customer app.
            </p>
          ) : null}
        </div>
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-black/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Milestone list</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
            {GHANA_PARTS_FLOW_LABELS.map((l) => (
              <li key={l} className="flex items-center gap-2">
                <span className="text-emerald-500" aria-hidden>
                  ✓
                </span>
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sample live progress</p>
          <p className="mb-2 mt-1 text-xs text-muted-foreground">Example: in transit (yours will match the real stage).</p>
          <GhanaPartsShipmentFlowVisual currentStage="IN_TRANSIT" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
