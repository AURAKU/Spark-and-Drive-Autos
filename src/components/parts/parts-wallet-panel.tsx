"use client";

import { Wallet } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";

type Props = {
  walletBalance: number;
  isSignedIn: boolean;
};

const PARTS_WALLET_COPY =
  "Your storefront wallet holds Ghana cedis for Parts and Accessories on this site. Top-ups run through a secured payment channel. When payment is authorised, your balance updates so you can check out.";

function formatGhs(amount: number) {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PartsWalletPanel({ walletBalance, isSignedIn }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-auto min-h-11 w-max shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-white"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Wallet className="size-4 text-[var(--brand)]" aria-hidden />
        <span className="min-w-0 text-left leading-none">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-400">Wallet</span>
          <span className="mt-1 block whitespace-nowrap text-xs font-semibold tabular-nums">{formatGhs(walletBalance)}</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="w-[min(100%-1.5rem,32rem)] max-h-[min(90vh,44rem)] overflow-y-auto rounded-2xl border-0 bg-transparent p-0 text-inherit backdrop:bg-black/70"
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white"
          >
            Close
          </button>
        </div>
        <WalletTopupFlow
          walletBalance={walletBalance}
          isSignedIn={isSignedIn}
          variant="card"
          defaultAmount={50}
          heading="Parts wallet"
          supportingText={PARTS_WALLET_COPY}
          signInHref="/login?callbackUrl=%2Fparts"
        />
        <span id={titleId} className="sr-only">
          Parts wallet
        </span>
      </dialog>
    </>
  );
}
