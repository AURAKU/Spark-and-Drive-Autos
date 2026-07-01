"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { EngineType } from "@prisma/client";
import { ChevronDown, ChevronUp, Loader2, Printer, Save } from "lucide-react";

import { saveDutyCalculationAction } from "@/actions/duty-intelligence-admin";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { formatMoney } from "@/lib/format";

import { DutyEstimateDisclosure } from "./duty-estimate-disclosure";
import { DutyOfficialLinks } from "./duty-official-links";

const VEHICLE_CATEGORIES = ["SUV", "SEDAN", "PICKUP", "TRUCK", "BUS", "VAN"] as const;
const SHIPPING_METHODS = ["CONTAINER", "RORO", "AIR_FREIGHT", "SEA_FREIGHT"] as const;
const CURRENCIES = ["USD", "CNY", "GHS"] as const;

type CarPrefill = {
  carId?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  vin?: string;
  fuelType?: EngineType;
  engineCc?: number;
  fobAmount?: number;
  fobCurrency?: string;
  freightGhs?: number;
  seaShippingFeeGhs?: number;
};

type Props = {
  prefill?: CarPrefill;
  compact?: boolean;
  showSave?: boolean;
};

const defaultYear = new Date().getFullYear() - 3;

export function DutyIntelligenceCalculator({ prefill, compact, showSave }: Props) {
  const [manufacturer, setManufacturer] = useState(prefill?.manufacturer ?? "");
  const [model, setModel] = useState(prefill?.model ?? "");
  const [trim, setTrim] = useState("");
  const [year, setYear] = useState(String(prefill?.year ?? defaultYear));
  const [vin, setVin] = useState(prefill?.vin ?? "");
  const [vehicleCategory, setVehicleCategory] = useState<string>("SUV");
  const [fuelType, setFuelType] = useState<EngineType>(prefill?.fuelType ?? EngineType.GASOLINE_PETROL);
  const [engineCc, setEngineCc] = useState(prefill?.engineCc != null ? String(prefill.engineCc) : "");
  const [batteryKwh, setBatteryKwh] = useState("");
  const [applyEvWaiver, setApplyEvWaiver] = useState(false);
  const [fobAmount, setFobAmount] = useState(
    prefill?.fobAmount != null ? String(prefill.fobAmount) : "",
  );
  const [fobCurrency, setFobCurrency] = useState(prefill?.fobCurrency ?? "USD");
  const [freightGhs, setFreightGhs] = useState(
    String(prefill?.freightGhs ?? prefill?.seaShippingFeeGhs ?? ""),
  );
  const [insuranceGhs, setInsuranceGhs] = useState("");
  const [shippingMethod, setShippingMethod] = useState<string>("SEA_FREIGHT");
  const [shippingLineCode, setShippingLineCode] = useState("");
  const [result, setResult] = useState<DutyIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shippingLines, setShippingLines] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/duty-intelligence/exchange-rates?from=USD")
      .then((r) => r.json())
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (prefill?.fuelType) setFuelType(prefill.fuelType);
    if (prefill?.fobAmount != null) setFobAmount(String(prefill.fobAmount));
  }, [prefill]);

  const inputPayload = useMemo((): DutyCalculationInput | null => {
    const y = Number(year);
    const fob = Number(fobAmount);
    if (!Number.isFinite(y) || !Number.isFinite(fob) || fob <= 0) return null;
    return {
      countryCode: "GH",
      carId: prefill?.carId,
      vehicle: {
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        trim: trim || undefined,
        year: y,
        vin: vin || undefined,
        vehicleCategory: vehicleCategory as DutyCalculationInput["vehicle"]["vehicleCategory"],
        fuelType,
        engineCc: engineCc.trim() ? Number(engineCc) : undefined,
        batteryKwh: batteryKwh.trim() ? Number(batteryKwh) : undefined,
        applyEvDutyWaiver: applyEvWaiver,
      },
      purchase: { fobAmount: fob, fobCurrency },
      shipping: {
        shippingMethod: shippingMethod as DutyCalculationInput["shipping"]["shippingMethod"],
        shippingLineCode: shippingLineCode || undefined,
        freightGhs: freightGhs.trim() ? Number(freightGhs) : undefined,
        insuranceGhs: insuranceGhs.trim() ? Number(insuranceGhs) : undefined,
        otherShippingChargesGhs: 0,
      },
    };
  }, [
    manufacturer, model, trim, year, vin, vehicleCategory, fuelType, engineCc, batteryKwh,
    applyEvWaiver, fobAmount, fobCurrency, freightGhs, insuranceGhs, shippingMethod,
    shippingLineCode, prefill?.carId,
  ]);

  const runCalculation = useCallback(() => {
    setError(null);
    setSaveMsg(null);
    if (!inputPayload) {
      setError("Enter vehicle year and FOB amount to calculate.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/duty-intelligence/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputPayload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Calculation failed");
          setResult(null);
          return;
        }
        setResult(data.result);
        if (data.result?.inputs?.shipping?.shippingLineCode) {
          // no-op
        }
      } catch {
        setError("Network error — could not reach duty engine.");
        setResult(null);
      }
    });
  }, [inputPayload]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (inputPayload && Number(fobAmount) > 0) runCalculation();
    }, compact ? 800 : 1200);
    return () => clearTimeout(t);
  }, [inputPayload, compact, fobAmount, runCalculation]);

  function handleSave() {
    if (!result || !inputPayload) return;
    startTransition(async () => {
      const saved = await saveDutyCalculationAction(inputPayload, result);
      if (saved.ok) setSaveMsg(`Saved as ${saved.referenceNumber}`);
      else setSaveMsg(saved.error ?? "Save failed");
    });
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground dark:border-white/15 dark:bg-black/40 dark:text-white";

  return (
    <div className={`rounded-2xl border border-border bg-card ${compact ? "p-4" : "p-5"} dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-black/40`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground dark:text-white">Duty Intelligence Engine</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Full landed cost: GRA taxes, port charges, shipping line fees, and agent costs. All rates from configurable database rules.
          </p>
        </div>
        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Confidence</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{result.confidence.score}%</p>
            <p className="text-[10px] text-muted-foreground">{result.confidence.label.replace("_", " ")} · {result.confidence.similarImportCount} similar</p>
          </div>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <label className="block text-xs text-muted-foreground">
          Manufacturer
          <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputCls} placeholder="Toyota" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder="RAV4" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Year
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className={inputCls} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Vehicle type
          <select value={vehicleCategory} onChange={(e) => setVehicleCategory(e.target.value)} className={inputCls}>
            {VEHICLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Fuel type
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as EngineType)} className={inputCls}>
            {Object.values(EngineType).map((t) => (
              <option key={t} value={t}>{engineTypeLabel(t)}</option>
            ))}
          </select>
        </label>
        {fuelType !== "ELECTRIC" && (
          <label className="block text-xs text-muted-foreground">
            Engine cc
            <input value={engineCc} onChange={(e) => setEngineCc(e.target.value)} inputMode="numeric" className={inputCls} />
          </label>
        )}
        {fuelType === "ELECTRIC" && (
          <label className="block text-xs text-muted-foreground">
            Battery kWh
            <input value={batteryKwh} onChange={(e) => setBatteryKwh(e.target.value)} inputMode="decimal" className={inputCls} />
          </label>
        )}
        <label className="block text-xs text-muted-foreground">
          FOB amount
          <input value={fobAmount} onChange={(e) => setFobAmount(e.target.value)} inputMode="decimal" className={inputCls} placeholder="18500" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Currency
          <select value={fobCurrency} onChange={(e) => setFobCurrency(e.target.value)} className={inputCls}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Freight (GHS)
          <input value={freightGhs} onChange={(e) => setFreightGhs(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Insurance (GHS)
          <input value={insuranceGhs} onChange={(e) => setInsuranceGhs(e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Shipping method
          <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} className={inputCls}>
            {SHIPPING_METHODS.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Shipping line
          <input value={shippingLineCode} onChange={(e) => setShippingLineCode(e.target.value.toUpperCase())} className={inputCls} placeholder="MSC, MAERSK…" />
        </label>
        {fuelType === "ELECTRIC" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input type="checkbox" checked={applyEvWaiver} onChange={(e) => setApplyEvWaiver(e.target.checked)} />
            Model EV duty waiver scenario
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runCalculation}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Calculate landed cost
        </button>
        {showSave && result && (
          <button type="button" onClick={handleSave} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm">
            <Save className="h-4 w-4" /> Save estimate
          </button>
        )}
        {result && (
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm">
            <Printer className="h-4 w-4" /> Print
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {saveMsg && <p className="mt-3 text-sm text-emerald-600">{saveMsg}</p>}

      {result && (
        <div className="mt-5 space-y-4 border-t border-border pt-4 dark:border-white/10">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between"><span className="text-muted-foreground">HS Code</span><span className="font-mono">{result.hsCode}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Exchange rate</span><span>1 {result.exchangeRate.fromCurrency} = {result.exchangeRate.rate} GHS</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">FOB</span><span>{formatMoney(result.summary.fobGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">CIF</span><span>{formatMoney(result.summary.cifGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customs value</span><span>{formatMoney(result.summary.customsValueGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GRA taxes</span><span>{formatMoney(result.summary.totalGraTaxesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Port charges</span><span>{formatMoney(result.summary.totalPortChargesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping line</span><span>{formatMoney(result.summary.shippingLineChargesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Agent fees</span><span>{formatMoney(result.summary.agentFeesGhs)}</span></div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated landed cost</p>
            <p className="text-2xl font-bold text-foreground dark:text-white">{formatMoney(result.summary.totalLandedCostGhs)}</p>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium dark:border-white/15"
          >
            Show calculation breakdown
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded && (
            <div className="space-y-3 text-xs">
              {result.stages.map((stage) => (
                <div key={stage.stage} className="rounded-lg border border-border p-3 dark:border-white/10">
                  <p className="font-semibold text-foreground dark:text-white">{stage.label}</p>
                  {stage.notes.map((n, i) => (
                    <p key={i} className="mt-1 text-muted-foreground">{n}</p>
                  ))}
                  {stage.lineItems.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {stage.lineItems.map((l) => (
                        <li key={l.code} className="flex justify-between gap-2 border-t border-border/50 pt-1 dark:border-white/5">
                          <span>{l.label}</span>
                          <span className="shrink-0 font-mono">{formatMoney(l.amountGhs)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <p className="text-muted-foreground">{result.methodologyNote}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <DutyEstimateDisclosure />
        <DutyOfficialLinks />
      </div>
    </div>
  );
}
