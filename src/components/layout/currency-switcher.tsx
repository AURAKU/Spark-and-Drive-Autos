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
    <label className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="hidden sm:inline">Prices</span>
      <select
        aria-label="Display currency"
        className="h-8 max-w-[5.5rem] rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none ring-[var(--brand)]/30 focus:ring-2 disabled:opacity-50"
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
