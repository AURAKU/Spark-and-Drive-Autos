"use client";

import { useCallback, useEffect, useState } from "react";

import {
  adminAmountToCanonicalRmb,
  convertRmbTo,
  formatConverted,
  type DisplayCurrency,
  type FxRatesInput,
} from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RatesPayload = {
  rates: {
    usdToRmb: number;
    rmbToGhs: number;
    usdToGhsStored: number;
  };
};

function toFxInput(r: RatesPayload["rates"]): FxRatesInput {
  return {
    usdToRmb: r.usdToRmb,
    rmbToGhs: r.rmbToGhs,
    usdToGhs: r.usdToGhsStored,
  };
}

const CURRENCY_OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: "GHS", label: "GHS" },
  { value: "USD", label: "USD" },
  { value: "CNY", label: "CNY (RMB)" },
];

type Props = {
  amountName?: string;
  currencyName?: string;
  label: string;
  description?: string;
  defaultAmount?: number;
  defaultCurrency?: DisplayCurrency;
  required?: boolean;
  lastSavedReferenceGhs?: number | null;
  /** `checkout` = GHS settlement preview; `supplier` = canonical RMB stored for cost. */
  previewVariant?: "checkout" | "supplier";
};

/**
 * Admin vehicle list price: amount + currency. Server derives canonical `basePriceRmb` + stores `basePriceAmount` / `basePriceCurrency`.
 */
export function AdminVehicleListPriceField({
  amountName = "basePriceAmount",
  currencyName = "basePriceCurrency",
  label,
  description,
  defaultAmount,
  defaultCurrency = "GHS",
  required = true,
  lastSavedReferenceGhs,
  previewVariant = "checkout",
}: Props) {
  const [amountStr, setAmountStr] = useState(() =>
    defaultAmount != null && Number.isFinite(defaultAmount) ? String(defaultAmount) : "",
  );
  const [currency, setCurrency] = useState<DisplayCurrency>(defaultCurrency);
  const [previewGhs, setPreviewGhs] = useState<number | null>(null);
  const [rates, setRates] = useState<FxRatesInput | null>(null);

  useEffect(() => {
    setAmountStr(defaultAmount != null && Number.isFinite(defaultAmount) ? String(defaultAmount) : "");
  }, [defaultAmount]);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/currency/rates");
        if (!res.ok) return;
        const data = (await res.json()) as RatesPayload;
        if (!cancelled) setRates(toFxInput(data.rates));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePreview = useCallback(
    (rawAmount: string, cur: DisplayCurrency) => {
      if (!rates) {
        setPreviewGhs(null);
        return;
      }
      const n = parseFloat(rawAmount);
      if (!Number.isFinite(n) || n < 0) {
        setPreviewGhs(null);
        return;
      }
      const rmb = adminAmountToCanonicalRmb(n, cur, rates);
      setPreviewGhs(previewVariant === "supplier" ? rmb : convertRmbTo(rmb, "GHS", rates));
    },
    [rates, previewVariant],
  );

  useEffect(() => {
    const t = window.setTimeout(() => updatePreview(amountStr, currency), 200);
    return () => window.clearTimeout(t);
  }, [amountStr, currency, updatePreview]);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor={amountName}>{label}</Label>
      {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
      <div className="mt-1 flex flex-wrap gap-2">
        <select
          id={currencyName}
          name={currencyName}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
          className="h-10 min-w-[8rem] rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2"
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          id={amountName}
          name={amountName}
          type="number"
          step="0.01"
          min={0}
          required={required}
          className="min-w-0 flex-1"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
        <p className="font-medium text-zinc-400">
          {previewVariant === "supplier"
            ? "Stored supplier cost — canonical RMB (current admin rates)"
            : "Checkout reference — GHS (current admin rates)"}
        </p>
        <p className="mt-0.5 text-sm text-[var(--brand)]">
          {previewGhs != null
            ? formatConverted(previewGhs, previewVariant === "supplier" ? "CNY" : "GHS")
            : rates
              ? "Enter a valid amount"
              : "Loading rates…"}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-600">
          {previewVariant === "supplier"
            ? "The form stores this line as RMB equivalent for margin math; currency you pick is for your own records."
            : "Canonical RMB is derived from this amount and currency on save. Customer checkout still settles in GHS using that RMB valuation."}
        </p>
        {previewVariant === "checkout" && lastSavedReferenceGhs != null && Number.isFinite(lastSavedReferenceGhs) ? (
          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-zinc-500">
            Last saved reference GHS:{" "}
            <span className="font-medium text-zinc-300">{formatConverted(lastSavedReferenceGhs, "GHS")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
