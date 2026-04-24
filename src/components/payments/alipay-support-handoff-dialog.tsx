"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEALERSHIP_PHONE_DISPLAY, DEALERSHIP_PHONE_TEL } from "@/lib/dealership-contact";
import { cn } from "@/lib/utils";

const WA_LINK = "https://wa.me/233552626997";

type Props = {
  paymentId: string;
  /** When `true` (e.g. `?alipay=1` on first land), open the handoff dialog once. */
  showHandoff: boolean;
};

/**
 * After creating a manual Alipay payment, prompt the user to contact support for merchant/QR details.
 */
export function AlipaySupportHandoffDialog({ paymentId, showHandoff }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (showHandoff) setOpen(true);
  }, [showHandoff]);

  function dismiss() {
    setOpen(false);
    if (showHandoff) {
      router.replace(`/dashboard/payments/${paymentId}`, { scroll: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="border border-cyan-500/20 bg-card text-card-foreground sm:max-w-md" showCloseButton>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Alipay (RMB)</p>
          <DialogTitle className="text-foreground">Get merchant payment details</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            Contact the support team for the merchant payment details on Alipay. We will share the correct payee/QR and
            the amount in RMB when you reach us.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm font-medium text-foreground">Call or WhatsApp</p>
            <a
              href={`tel:${DEALERSHIP_PHONE_TEL}`}
              className="mt-1 block text-2xl font-bold tabular-nums text-[var(--brand)] hover:underline"
            >
              {DEALERSHIP_PHONE_DISPLAY}
            </a>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={`tel:${DEALERSHIP_PHONE_TEL}`}
              className={cn(buttonVariants(), "w-full justify-center sm:flex-1 sm:min-w-0")}
            >
              Call now
            </a>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "w-full justify-center border border-[#25D366]/40 bg-[#25D366]/15 text-foreground hover:bg-[#25D366]/25 sm:flex-1 sm:min-w-0",
              )}
            >
              WhatsApp
            </a>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            When you have paid, upload your Alipay confirmation screenshot in the section below.
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={() => dismiss()}>
            Got it
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/dashboard/payments" className="text-[var(--brand)] hover:underline">
              All payments
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
