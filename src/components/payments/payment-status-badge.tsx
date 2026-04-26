import type { PaymentStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

/** High contrast in light mode; softer glass in dark mode. */
const STYLES: Record<PaymentStatus, string> = {
  PENDING:
    "border-amber-700/40 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100 dark:shadow-none",
  AWAITING_PROOF:
    "border-amber-800/35 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-400/45 dark:bg-amber-400/12 dark:text-amber-50 dark:shadow-none",
  PROCESSING:
    "border-sky-700/40 bg-sky-100 text-sky-950 shadow-sm dark:border-sky-500/35 dark:bg-sky-500/12 dark:text-sky-100 dark:shadow-none",
  UNDER_REVIEW:
    "border-violet-700/40 bg-violet-100 text-violet-950 shadow-sm dark:border-violet-500/35 dark:bg-violet-500/12 dark:text-violet-100 dark:shadow-none",
  SUCCESS:
    "border-emerald-700/40 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-100 dark:shadow-none",
  FAILED:
    "border-red-700/40 bg-red-100 text-red-950 shadow-sm dark:border-red-500/40 dark:bg-red-500/12 dark:text-red-100 dark:shadow-none",
  REFUNDED:
    "border-zinc-500/50 bg-zinc-200 text-zinc-900 shadow-sm dark:border-zinc-500/35 dark:bg-zinc-500/15 dark:text-zinc-200 dark:shadow-none",
  DISPUTED:
    "border-orange-700/40 bg-orange-100 text-orange-950 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/12 dark:text-orange-100 dark:shadow-none",
  REVERSED:
    "border-zinc-600/40 bg-zinc-300 text-zinc-950 shadow-sm dark:border-zinc-500/40 dark:bg-zinc-600/25 dark:text-zinc-100 dark:shadow-none",
};

function label(s: PaymentStatus): string {
  return s.replaceAll("_", " ");
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        STYLES[status] ?? STYLES.PENDING,
        className,
      )}
    >
      {label(status)}
    </span>
  );
}

const WALLET_STYLES: Record<string, string> = {
  SUCCESS:
    "border-emerald-700/40 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-100 dark:shadow-none",
  PENDING:
    "border-amber-700/40 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100 dark:shadow-none",
  FAILED:
    "border-rose-700/40 bg-rose-100 text-rose-950 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/12 dark:text-rose-100 dark:shadow-none",
};

/** Wallet ledger row status — same contrast rules as payment badges. */
export function WalletLedgerStatusBadge({ status }: { status: string }) {
  const style = WALLET_STYLES[status] ?? WALLET_STYLES.FAILED;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        style,
      )}
    >
      {status}
    </span>
  );
}
