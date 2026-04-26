"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { className?: string };

export function DashboardOverviewRefresh({ className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        window.setTimeout(() => setBusy(false), 600);
      }}
      className={
        className ??
        "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-5 py-2.5 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/20 dark:border-[var(--brand)]/50 dark:text-[var(--brand)] dark:hover:bg-[var(--brand)]/15 disabled:opacity-60"
      }
    >
      {busy ? "Refreshing…" : "Refresh Page"}
    </button>
  );
}
