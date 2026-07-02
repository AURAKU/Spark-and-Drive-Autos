"use client";

import Link from "next/link";
import { useState } from "react";

import { CheckoutBlockedDialog } from "@/components/checkout/checkout-blocked-dialog";
import { formatMoney } from "@/lib/format";

type Props = {
  motorcycleId: string;
  canPayOnline: boolean;
  blockTitle: string;
  blockMessage: string;
  reserveAvailable?: boolean;
  reservationDepositGhs?: number;
  reservationDepositPercentLabel?: number;
};

export function MotorcycleCheckoutPayRow({
  motorcycleId,
  canPayOnline,
  blockTitle,
  blockMessage,
  reserveAvailable = true,
  reservationDepositGhs,
  reservationDepositPercentLabel,
}: Props) {
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const payClass =
    "inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-[#041014] shadow-[0_0_20px_-4px_rgba(20,216,230,0.5)] transition hover:bg-[var(--brand-deep)] hover:text-white";
  const reserveClass =
    "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-100 dark:border-white/25 dark:bg-white dark:text-black";

  if (canPayOnline) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          <Link href={`/checkout?motorcycleId=${motorcycleId}&type=FULL`} className={payClass}>
            Pay full
          </Link>
          {reserveAvailable ? (
            <Link href={`/checkout?motorcycleId=${motorcycleId}&type=RESERVATION_DEPOSIT`} className={reserveClass}>
              Reserve with deposit
            </Link>
          ) : null}
        </div>
        {reserveAvailable && reservationDepositGhs != null && reservationDepositPercentLabel != null ? (
          <p className="text-xs text-muted-foreground">
            Reserve with {reservationDepositPercentLabel}% deposit ({formatMoney(reservationDepositGhs, "GHS")}).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button type="button" className={payClass} onClick={() => setBlockedDialogOpen(true)}>
        Pay full
      </button>
      <CheckoutBlockedDialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen} title={blockTitle} message={blockMessage} allowDismiss />
    </>
  );
}
