"use client";

import { useCallback, useEffect, useState } from "react";

import { convertRmbTo, formatConverted, type FxRatesInput } from "@/lib/currency";
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
  /** GHS snapshot already stored in DB from the last save (admin reference). */
  lastSavedReferenceGhs?: number | null;
};

/**
 * RMB selling price input with live reference GHS preview (same formula as server save).
 * On submit, `createCar` / `updateCar` / `createPart` / `updatePart` persist the matching GHS on `price` / `priceGhs`.
 */
export function AdminRmbSellingPriceField({
  id = "basePriceRmb",
  name = "basePriceRmb",
  label,
  description,
  defaultValue,
  required = true,
  lastSavedReferenceGhs,
}: Props) {
  const [rmbStr, setRmbStr] = useState(() =>
    defaultValue != null && Number.isFinite(defaultValue) ? String(defaultValue) : "",
  );
  const [previewGhs, setPreviewGhs] = useState<number | null>(null);
  const [rates, setRates] = useState<FxRatesInput | null>(null);

  useEffect(() => {
    setRmbStr(defaultValue != null && Number.isFinite(defaultValue) ? String(defaultValue) : "");
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
        setPreviewGhs(null);
        return;
      }
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        setPreviewGhs(null);
        return;
      }
      setPreviewGhs(convertRmbTo(n, "GHS", rates));
    },
    [rates],
  );

  useEffect(() => {
    const t = window.setTimeout(() => updatePreview(rmbStr), 200);
    return () => window.clearTimeout(t);
  }, [rmbStr, updatePreview]);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
      <Input
        id={id}
        name={name}
        type="number"
        step="0.01"
        min={0}
        required={required}
        className="mt-1"
        value={rmbStr}
        onChange={(e) => setRmbStr(e.target.value)}
        autoComplete="off"
      />
      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
        <p className="font-medium text-zinc-400">Reference GHS (current admin rates)</p>
        <p className="mt-0.5 text-sm text-[var(--brand)]">
          {previewGhs != null ? formatConverted(previewGhs, "GHS") : rates ? "Enter a valid RMB amount" : "Loading rates…"}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-600">
          This value is <span className="text-zinc-500">saved to the database</span> when you submit, so you can use it for
          quoting and ops without recalculating.
        </p>
        {lastSavedReferenceGhs != null && Number.isFinite(lastSavedReferenceGhs) ? (
          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-zinc-500">
            Last saved reference GHS:{" "}
            <span className="font-medium text-zinc-300">{formatConverted(lastSavedReferenceGhs, "GHS")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
