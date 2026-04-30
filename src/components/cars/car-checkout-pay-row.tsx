"use client";

import Link from "next/link";
import { useState } from "react";

import { CheckoutBlockedDialog } from "@/components/checkout/checkout-blocked-dialog";
import { formatMoney } from "@/lib/format";

type Props = {
  carId: string;
  canPayOnline: boolean;
  blockTitle: string;
  blockMessage: string;
  /** Shown when online checkout is available: estimated deposit from list price (GHS) and % label. */
  reservationDepositGhs?: number;
  reservationDepositPercentLabel?: number;
};

export function CarCheckoutPayRow({
  carId,
  canPayOnline,
  blockTitle,
  blockMessage,
  reservationDepositGhs,
  reservationDepositPercentLabel,
}: Props) {
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);

  const payClass =
    "inline-flex h-8 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-[#041014] shadow-[0_0_20px_-4px_rgba(20,216,230,0.5)] transition hover:bg-[var(--brand-deep)] hover:text-white hover:shadow-[0_0_24px_-4px_rgba(20,216,230,0.35)]";
  const reserveClass =
    "inline-flex h-8 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-black transition hover:bg-zinc-100 dark:border-white/25 dark:bg-white dark:text-black dark:hover:bg-zinc-100";

  if (canPayOnline) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          <Link href={`/checkout?carId=${carId}&type=FULL`} className={payClass}>
            Pay now
          </Link>
          <Link href={`/checkout?carId=${carId}&type=RESERVATION_DEPOSIT`} className={reserveClass}>
            Reserve with deposit
          </Link>
        </div>
        {reservationDepositGhs != null && reservationDepositPercentLabel != null ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">Reserve with deposit:</span>{" "}
            {formatMoney(reservationDepositGhs, "GHS")} ({reservationDepositPercentLabel}% of list price in GHS; minimum
            deposit rules apply).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button type="button" className={payClass} onClick={() => setBlockedDialogOpen(true)}>
        Pay now
      </button>
      <button type="button" className={reserveClass} onClick={() => setBlockedDialogOpen(true)}>
        Reserve with deposit
      </button>
      <CheckoutBlockedDialog
        open={blockedDialogOpen}
        onOpenChange={setBlockedDialogOpen}
        title={blockTitle}
        message={blockMessage}
        allowDismiss
      />
    </>
  );
}
