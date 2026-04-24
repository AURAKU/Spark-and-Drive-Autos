"use client";

import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEALERSHIP_EMAIL,
  DEALERSHIP_PHONE_DISPLAY,
  DEALERSHIP_PHONE_TEL,
} from "@/lib/dealership-contact";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  /** Default "Checkout unavailable"; use e.g. "Payment cannot continue" for live API conflicts. */
  eyebrow?: string;
  /** Checkout page: user cannot dismiss until they navigate away. Car detail: dismissible. */
  allowDismiss?: boolean;
};

export function CheckoutBlockedDialog({
  open,
  onOpenChange,
  title,
  message,
  eyebrow = "Checkout unavailable",
  allowDismiss = true,
}: Props) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal={!allowDismiss}
      onOpenChange={(next, eventDetails) => {
        if (!allowDismiss && !next) {
          eventDetails.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={allowDismiss}
        className="overflow-hidden border border-amber-500/35 bg-[#0a0e14] p-0 text-popover-foreground shadow-2xl sm:max-w-md"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="px-6 pb-6 pt-8">
          <DialogHeader className="space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">{eyebrow}</p>
            <DialogTitle className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-zinc-300">{message}</DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-200">
            <p className="font-medium text-zinc-100">Contact the dealership</p>
            <p className="leading-relaxed text-zinc-400">
              Call{" "}
              <a
                href={`tel:${DEALERSHIP_PHONE_TEL}`}
                className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
              >
                {DEALERSHIP_PHONE_DISPLAY}
              </a>{" "}
              or email{" "}
              <a
                href={`mailto:${DEALERSHIP_EMAIL}`}
                className="break-all font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
              >
                {DEALERSHIP_EMAIL}
              </a>
              .
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <BrowseCarsCtaLink
              href="/inventory"
              size="default"
              className="!min-h-11 w-full justify-center sm:w-auto sm:min-w-[160px]"
            />
            <a
              href={`tel:${DEALERSHIP_PHONE_TEL}`}
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className:
                    "h-11 w-full justify-center border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.06] sm:w-auto sm:min-w-[160px]",
                }),
              )}
            >
              Call now
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
