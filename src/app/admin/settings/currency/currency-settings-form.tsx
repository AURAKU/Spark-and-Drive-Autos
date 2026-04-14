"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { updateGlobalExchangeRates } from "@/actions/exchange-settings";
import { formatConverted, getCarDisplayPrice, getExchangeRateSummary } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { ok?: boolean; error?: string } | null;

/** Example vehicle base price for live preview (RMB). */
const SAMPLE_RMB = 100_000;

export function CurrencySettingsForm({
  initial,
}: {
  initial: {
    usdToRmb: number;
    rmbToGhs: number;
    usdToGhs: number;
    updatedAt: string;
    updatedByLabel: string | null;
  } | null;
}) {
  const [state, action] = useActionState(updateGlobalExchangeRates, null as State);

  const [usdToRmb, setUsdToRmb] = useState(initial?.usdToRmb ?? 7);
  const [rmbToGhs, setRmbToGhs] = useState(initial?.rmbToGhs ?? 0.586);
  const [usdToGhs, setUsdToGhs] = useState(initial?.usdToGhs ?? 11.65);

  useEffect(() => {
    if (initial) {
      setUsdToRmb(initial.usdToRmb);
      setRmbToGhs(initial.rmbToGhs);
      setUsdToGhs(initial.usdToGhs);
    }
  }, [initial]);

  const previewSettings = useMemo(() => {
    const u = Number.isFinite(usdToRmb) && usdToRmb > 0 ? usdToRmb : 7;
    const r = Number.isFinite(rmbToGhs) && rmbToGhs > 0 ? rmbToGhs : 0.586;
    const g = Number.isFinite(usdToGhs) && usdToGhs > 0 ? usdToGhs : 11.65;
    return { usdToRmb: u, rmbToGhs: r, usdToGhs: g };
  }, [usdToRmb, rmbToGhs, usdToGhs]);

  const summary = useMemo(() => getExchangeRateSummary(previewSettings), [previewSettings]);

  const sampleGhs = useMemo(
    () => getCarDisplayPrice(SAMPLE_RMB, "GHS", previewSettings),
    [previewSettings],
  );
  const sampleUsd = useMemo(
    () => getCarDisplayPrice(SAMPLE_RMB, "USD", previewSettings),
    [previewSettings],
  );
  const sampleCny = useMemo(
    () => getCarDisplayPrice(SAMPLE_RMB, "CNY", previewSettings),
    [previewSettings],
  );

  return (
    <form action={action} className="mt-8 max-w-xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        {initial && (
          <div className="mb-6 space-y-1 text-xs text-zinc-500">
            <p>
              Last saved: <span className="text-zinc-300">{new Date(initial.updatedAt).toLocaleString()}</span>
            </p>
            {initial.updatedByLabel ? (
              <p>
                By: <span className="text-zinc-300">{initial.updatedByLabel}</span>
              </p>
            ) : null}
          </div>
        )}
        {state?.error && <p className="mb-4 text-sm text-red-400">{state.error}</p>}
        {state?.ok && (
          <p className="mb-4 text-sm text-emerald-400">
            Rates saved. All storefront and admin list prices now use the new FX; cached GHS on each vehicle row was
            refreshed for Paystack.
          </p>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="usdToRmb">1 USD = ? RMB (CNY)</Label>
            <p className="mt-0.5 text-[11px] text-zinc-500">How many Chinese yuan one US dollar buys.</p>
            <Input
              id="usdToRmb"
              name="usdToRmb"
              type="number"
              step="0.000001"
              min={0.000001}
              required
              className="mt-1"
              value={usdToRmb}
              onChange={(e) => setUsdToRmb(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="rmbToGhs">RMB → GHS divisor (D)</Label>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              GHS = round(RMB ÷ D). GHS → RMB: RMB = GHS × D. Example: 10,000 RMB ÷ 0.586 ≈ 17,064 GHS.
            </p>
            <Input
              id="rmbToGhs"
              name="rmbToGhs"
              type="number"
              step="0.000001"
              min={0.000001}
              required
              className="mt-1"
              value={rmbToGhs}
              onChange={(e) => setRmbToGhs(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="usdToGhs">1 USD = ? GHS (direct)</Label>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              USD ↔ GHS without going through RMB: GHS = USD × rate; USD = GHS ÷ rate (e.g. 100 × 11.65 = 1,165 GHS).
            </p>
            <Input
              id="usdToGhs"
              name="usdToGhs"
              type="number"
              step="0.000001"
              min={0.000001}
              required
              className="mt-1"
              value={usdToGhs}
              onChange={(e) => setUsdToGhs(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-4 text-sm text-zinc-300">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Live preview (not saved yet)</p>
          <p className="mt-2 text-xs text-zinc-500">
            For a vehicle with base price <span className="font-mono text-zinc-300">{SAMPLE_RMB.toLocaleString()} RMB</span>:
          </p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            <li className="flex flex-wrap items-baseline justify-between gap-2">
              <span>Display as GHS</span>
              <span className="font-mono text-[var(--brand)]">{formatConverted(sampleGhs, "GHS")}</span>
            </li>
            <li className="flex flex-wrap items-baseline justify-between gap-2">
              <span>Display as USD</span>
              <span className="font-mono text-zinc-200">{formatConverted(sampleUsd, "USD")}</span>
            </li>
            <li className="flex flex-wrap items-baseline justify-between gap-2">
              <span>Display as CNY (RMB)</span>
              <span className="font-mono text-zinc-200">{formatConverted(sampleCny, "CNY")}</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cross-check</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            <li>
              1 USD → GHS via RMB chain (usdToRmb ÷ divisor D):{" "}
              <span className="font-mono text-zinc-200">{summary.usdToGhsDerived.toFixed(4)}</span>
            </li>
            <li>
              Direct USD → GHS rate (saved above):{" "}
              <span className="font-mono text-zinc-200">{summary.usdToGhsStored.toFixed(4)}</span>
            </li>
            <li>
              1 GHS → RMB (multiply by D): <span className="font-mono text-zinc-200">{summary.rmbPerGhs.toFixed(6)}</span> RMB
            </li>
          </ul>
        </div>

        <Button type="submit" className="mt-6">
          Save exchange rates
        </Button>
      </div>
    </form>
  );
}
