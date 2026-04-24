"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { CURRENCY_LABELS, type DisplayCurrency } from "@/lib/currency";

const ORDER: DisplayCurrency[] = ["GHS", "USD", "CNY"];

export function CurrencySwitcher({ initial }: { initial: DisplayCurrency }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onChange(next: DisplayCurrency) {
    if (next === initial) return;
    await fetch("/api/currency/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
      <span className="shrink-0 text-xs font-medium tracking-wide text-zinc-300 sm:text-[0.8125rem]">Currency</span>
      <select
        aria-label="Display currency"
        className="h-8 min-w-[7.5rem] rounded-lg border border-white/10 bg-black/40 px-3 text-xs font-medium tabular-nums text-white outline-none ring-[var(--brand)]/30 focus:ring-2 disabled:opacity-50 sm:min-w-[8.25rem]"
        value={initial}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as DisplayCurrency)}
      >
        {ORDER.map((value) => (
          <option key={value} value={value}>
            {CURRENCY_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
