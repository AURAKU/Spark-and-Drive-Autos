"use client";

import { useCallback, useEffect, useState } from "react";

import { convertRmbTo, formatConverted, type FxRatesInput } from "@/lib/currency";
import { ghsSellingPriceToCanonicalBasePriceRmb } from "@/lib/parts-pricing";
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

type Props = {
  id?: string;
  name?: string;
  label: string;
  description?: string;
  defaultValue?: number;
  required?: boolean;
};

/**
 * GHS selling price for Ghana-origin parts. Canonical stored `basePriceRmb` is derived on the server;
 * this panel shows an approximate RMB reference for admin quoting.
 */
export function AdminGhsSellingPriceField({
  id = "basePriceGhs",
  name = "basePriceGhs",
  label,
  description,
  defaultValue,
  required = true,
}: Props) {
  const [ghsStr, setGhsStr] = useState(() =>
    defaultValue != null && Number.isFinite(defaultValue) ? String(Math.round(defaultValue)) : "",
  );
  const [previewRmb, setPreviewRmb] = useState<number | null>(null);
  const [rates, setRates] = useState<FxRatesInput | null>(null);

  useEffect(() => {
    setGhsStr(defaultValue != null && Number.isFinite(defaultValue) ? String(Math.round(defaultValue)) : "");
  }, [defaultValue]);

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
    (raw: string) => {
      if (!rates) {
        setPreviewRmb(null);
        return;
      }
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        setPreviewRmb(null);
        return;
      }
      const canonicalRmb = ghsSellingPriceToCanonicalBasePriceRmb(n, rates);
      setPreviewRmb(convertRmbTo(canonicalRmb, "CNY", rates));
    },
    [rates],
  );

  useEffect(() => {
    const t = window.setTimeout(() => updatePreview(ghsStr), 200);
    return () => window.clearTimeout(t);
  }, [ghsStr, updatePreview]);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
      <Input
        id={id}
        name={name}
        type="number"
        step="1"
        min={0}
        required={required}
        className="mt-1"
        value={ghsStr}
        onChange={(e) => setGhsStr(e.target.value)}
        autoComplete="off"
      />
      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
        <p className="font-medium text-zinc-400">Reference RMB equivalent (current admin rates)</p>
        <p className="mt-0.5 text-sm text-[var(--brand)]">
          {previewRmb != null ? formatConverted(previewRmb, "CNY") : rates ? "Enter a valid GHS amount" : "Loading rates…"}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-600">
          Sell in Ghana cedis — this listing stores the matching canonical RMB field for the catalog engine (same as
          China-origin parts).
        </p>
      </div>
    </div>
  );
}
