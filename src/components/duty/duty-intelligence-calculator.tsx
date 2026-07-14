"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { EngineType } from "@prisma/client";
import { Check, ChevronDown, ChevronUp, Loader2, Printer, Save, Shield } from "lucide-react";

import { saveDutyCalculationAction } from "@/actions/duty-intelligence-admin";
import { prepareDutyReportAction } from "@/actions/duty-intelligence-report";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import type { IntakeQuestion } from "@/lib/duty-intelligence/intake-questions";
import {
  EXPORT_COUNTRIES,
  SUPPORTED_CURRENCIES,
  type DutyCalculationInput,
  type DutyConfidenceLevel,
  type DutyIntelligenceResult,
} from "@/lib/duty-intelligence/types";
import { formatMoney } from "@/lib/format";

import { DutyEstimateDisclosure } from "./duty-estimate-disclosure";
import { DutyIntelligenceSourceNote } from "./duty-intelligence-source-note";

const VEHICLE_CATEGORIES = ["SUV", "SEDAN", "PICKUP", "TRUCK", "BUS", "VAN"] as const;
const SHIPPING_METHODS = ["SEA_FREIGHT", "CONTAINER", "RORO", "AIR_FREIGHT"] as const;
const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "DCT"] as const;
const DRIVE_TYPES = ["FWD", "RWD", "AWD", "4WD"] as const;

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
  countryOfOrigin?: string;
};

type Props = {
  prefill?: CarPrefill;
  compact?: boolean;
  showSave?: boolean;
  isAdmin?: boolean;
};

const CONFIDENCE_LABELS: Record<DutyConfidenceLevel, string> = {
  VERIFIED_PROFILE_HIGH: "Verified profile",
  STRONG_EVIDENCE: "Strong evidence",
  MODERATE_EVIDENCE: "Moderate evidence",
  LIMITED_EVIDENCE: "Limited evidence",
  ADMIN_REVIEW_REQUIRED: "Review required",
};

type ResolvedVehicleSpec = {
  source: string;
  confidence: string;
  inferredFields: Record<string, { value: string | number; source: string }>;
  needsConfirmation: string[];
  engineCc?: number;
  powerKw?: number;
  vehicleCategory?: string;
  countryOfOrigin?: string;
  fuelType?: string;
  year?: number;
};

const defaultYear = new Date().getFullYear() - 3;

export function DutyIntelligenceCalculator({ prefill, compact, showSave, isAdmin }: Props) {
  const [manufacturer, setManufacturer] = useState(prefill?.manufacturer ?? "");
  const [model, setModel] = useState(prefill?.model ?? "");
  const [year, setYear] = useState(String(prefill?.year ?? defaultYear));
  const [vin, setVin] = useState(prefill?.vin ?? "");
  const [countryOfOrigin, setCountryOfOrigin] = useState(prefill?.countryOfOrigin ?? "CHINA");
  const [vehicleCategory, setVehicleCategory] = useState<string>("SUV");
  const [fuelType, setFuelType] = useState<EngineType>(prefill?.fuelType ?? EngineType.GASOLINE_PETROL);
  const [engineCc, setEngineCc] = useState(prefill?.engineCc != null ? String(prefill.engineCc) : "");
  const [transmission, setTransmission] = useState("");
  const [driveType, setDriveType] = useState("");
  const [fobAmount, setFobAmount] = useState(prefill?.fobAmount != null ? String(prefill.fobAmount) : "");
  const [fobCurrency, setFobCurrency] = useState(prefill?.fobCurrency ?? "USD");
  const [shippingMethod, setShippingMethod] = useState<string>("SEA_FREIGHT");
  const [result, setResult] = useState<DutyIntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminHint, setAdminHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [pending, startTransition] = useTransition();
  const [powerKw, setPowerKw] = useState("");
  const [freightOverride, setFreightOverride] = useState("");
  const [insuranceOverride, setInsuranceOverride] = useState("");
  const [hsCodeOverride, setHsCodeOverride] = useState("");
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([]);
  const [resolvedSpec, setResolvedSpec] = useState<ResolvedVehicleSpec | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (prefill?.fuelType) setFuelType(prefill.fuelType);
    if (prefill?.fobAmount != null) setFobAmount(String(prefill.fobAmount));
    if (prefill?.countryOfOrigin) setCountryOfOrigin(prefill.countryOfOrigin);
  }, [prefill]);

  const showQuestion = useCallback(
    (id: string) => intakeQuestions.some((q) => q.id === id),
    [intakeQuestions],
  );

  useEffect(() => {
    const controller = new AbortController();
    const payload = {
      countryCode: "GH",
      carId: prefill?.carId,
      vehicle: {
        manufacturer,
        model,
        year: Number(year) || defaultYear,
        fuelType,
        engineCc: engineCc.trim() ? Number(engineCc) : undefined,
        powerKw: powerKw.trim() ? Number(powerKw) : undefined,
        vehicleCategory: vehicleCategory || undefined,
        countryOfOrigin: countryOfOrigin || undefined,
        vin: vin.trim() || undefined,
        confirmedFields: [...confirmedFields],
      },
      purchase: { fobAmount: Number(fobAmount) || 0, fobCurrency },
      expertMode: isAdmin === true,
    };

    fetch("/api/duty-intelligence/intake-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        hasShippingConfig: !freightOverride.trim(),
        hasInsuranceConfig: !insuranceOverride.trim(),
        inferredFromInventory: Boolean(prefill?.carId),
        classificationUnresolved: false,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.questions) setIntakeQuestions(data.questions);
      })
      .catch(() => {});

    if (manufacturer.trim() && model.trim()) {
      fetch("/api/duty-intelligence/resolve-vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.spec) {
            setResolvedSpec(data.spec);
            if (data.spec.engineCc && !engineCc) setEngineCc(String(data.spec.engineCc));
            if (data.spec.powerKw && !powerKw) setPowerKw(String(data.spec.powerKw));
            if (data.spec.vehicleCategory && vehicleCategory === "SUV") setVehicleCategory(data.spec.vehicleCategory);
            if (data.spec.countryOfOrigin && countryOfOrigin === "CHINA" && prefill?.carId) {
              setCountryOfOrigin(data.spec.countryOfOrigin);
            }
          }
        })
        .catch(() => {});
    }

    return () => controller.abort();
  }, [
    manufacturer, model, year, fuelType, engineCc, powerKw, vehicleCategory, countryOfOrigin, vin,
    fobAmount, fobCurrency, prefill?.carId, isAdmin, freightOverride, insuranceOverride, confirmedFields,
  ]);

  const inputPayload = useMemo((): DutyCalculationInput | null => {
    const y = Number(year);
    const fob = Number(fobAmount);
    const cc = engineCc.trim() ? Number(engineCc) : undefined;
    const kw = powerKw.trim() ? Number(powerKw) : undefined;
    if (!manufacturer.trim() || !model.trim()) return null;
    if (!Number.isFinite(y) || !Number.isFinite(fob) || fob <= 0) return null;
    if (fuelType !== "ELECTRIC" && (!cc || cc <= 0)) return null;
    if (fuelType === "ELECTRIC" && !cc && !kw) return null;

    return {
      countryCode: "GH",
      carId: prefill?.carId,
      hsCodeOverride: isAdmin && hsCodeOverride.trim() ? hsCodeOverride.trim() : undefined,
      vehicle: {
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        year: y,
        vin: vin.trim() || undefined,
        countryOfOrigin: (countryOfOrigin || "CHINA") as DutyCalculationInput["vehicle"]["countryOfOrigin"],
        vehicleCategory: (vehicleCategory || "SUV") as DutyCalculationInput["vehicle"]["vehicleCategory"],
        fuelType,
        engineCc: cc,
        batteryKwh: kw,
        transmission: transmission || undefined,
        driveType: driveType || undefined,
        applyEvDutyWaiver: false,
      },
      purchase: { fobAmount: fob, fobCurrency: fobCurrency as DutyCalculationInput["purchase"]["fobCurrency"] },
      shipping: {
        shippingMethod: shippingMethod as DutyCalculationInput["shipping"]["shippingMethod"],
        freightGhsOverride: freightOverride.trim() ? Number(freightOverride) : undefined,
        insuranceGhsOverride: insuranceOverride.trim() ? Number(insuranceOverride) : undefined,
        otherShippingChargesGhs: 0,
      },
    };
  }, [
    manufacturer, model, year, vin, countryOfOrigin, vehicleCategory, fuelType, engineCc, powerKw,
    transmission, driveType, fobAmount, fobCurrency, shippingMethod, prefill?.carId, isAdmin,
    hsCodeOverride, freightOverride, insuranceOverride,
  ]);

  const runCalculation = useCallback(() => {
    setError(null);
    setAdminHint(null);
    setSaveMsg(null);
    if (!inputPayload) {
      setError("Complete all required fields: manufacturer, model, year, engine CC, and FOB amount.");
      return;
    }
    setProgress(15);
    startTransition(async () => {
      try {
        setProgress(40);
        const res = await fetch("/api/duty-intelligence/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputPayload),
        });
        setProgress(80);
        const data = await res.json();
        if (!res.ok) {
          setError(data.message ?? "Unable to calculate duty estimate at this time.");
          if (isAdmin && data.adminHint) setAdminHint(data.adminHint);
          setResult(null);
          setProgress(0);
          return;
        }
        setResult(data.result);
        setProgress(100);
        setTimeout(() => setProgress(0), 600);
      } catch {
        setError("Unable to reach the duty engine. Please try again.");
        setResult(null);
        setProgress(0);
      }
    });
  }, [inputPayload, isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (inputPayload) runCalculation();
    }, compact ? 800 : 1200);
    return () => clearTimeout(t);
  }, [inputPayload, compact, runCalculation]);

  function handleSave() {
    if (!result || !inputPayload) return;
    startTransition(async () => {
      const saved = await saveDutyCalculationAction(inputPayload, result);
      if (saved.ok) setSaveMsg(`Saved as ${saved.referenceNumber}`);
      else setSaveMsg(saved.error ?? "Save failed");
    });
  }

  async function handlePrintReport() {
    if (!result || !inputPayload || reportPending) return;
    setReportError(null);
    setReportPending(true);
    try {
      const prepared = await prepareDutyReportAction(inputPayload, result);
      if (!prepared.ok) {
        setReportError(prepared.error);
        return;
      }
      window.open(prepared.reportUrl, "_blank", "noopener,noreferrer");
    } catch {
      setReportError("Could not open the report. Please try again.");
    } finally {
      setReportPending(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm text-foreground backdrop-blur-sm dark:border-white/15 dark:bg-black/40 dark:text-white";

  return (
    <div
      className={`rounded-2xl border border-border bg-card/80 backdrop-blur-md ${compact ? "p-4" : "p-5"} dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.06] dark:to-black/50`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground dark:text-white">Ghana Duty Estimate</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter make, model, year, fuel type, and purchase price. Freight and insurance are estimated automatically unless you provide them.
          </p>
        </div>
        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Confidence</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {CONFIDENCE_LABELS[result.confidence.level]}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {result.calibration?.cohortSize ?? result.confidence.similarImportCount} similar case(s)
            </p>
          </div>
        )}
      </div>

      {progress > 0 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <label className="block text-xs text-muted-foreground">
          Manufacturer *
          <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputCls} placeholder="Toyota" required />
        </label>
        <label className="block text-xs text-muted-foreground">
          Model *
          <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder="RAV4" required />
        </label>
        <label className="block text-xs text-muted-foreground">
          Year of manufacture *
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className={inputCls} max={new Date().getFullYear()} />
        </label>
        {(showQuestion("vehicleCategory") || !prefill?.carId) && (
          <label className="block text-xs text-muted-foreground">
            Vehicle category{showQuestion("vehicleCategory") && intakeQuestions.find((q) => q.id === "vehicleCategory")?.required ? " *" : ""}
            <select value={vehicleCategory} onChange={(e) => setVehicleCategory(e.target.value)} className={inputCls}>
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs text-muted-foreground">
          Fuel type *
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as EngineType)} className={inputCls}>
            {Object.values(EngineType).map((t) => (
              <option key={t} value={t}>{engineTypeLabel(t)}</option>
            ))}
          </select>
        </label>
        {fuelType !== "ELECTRIC" && (
          <label className="block text-xs text-muted-foreground">
            Engine capacity (CC) *
            <input value={engineCc} onChange={(e) => setEngineCc(e.target.value)} inputMode="numeric" className={inputCls} placeholder="2000" />
          </label>
        )}
        {fuelType === "ELECTRIC" && (showQuestion("powerKw") || !powerKw) && (
          <label className="block text-xs text-muted-foreground">
            Electric power (kW){showQuestion("powerKw") && intakeQuestions.find((q) => q.id === "powerKw")?.required ? " *" : ""}
            <input value={powerKw} onChange={(e) => setPowerKw(e.target.value)} inputMode="decimal" className={inputCls} placeholder="170" />
          </label>
        )}
        <label className="block text-xs text-muted-foreground">
          Purchase / FOB amount *
          <input value={fobAmount} onChange={(e) => setFobAmount(e.target.value)} inputMode="decimal" className={inputCls} placeholder="18500" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Currency *
          <select value={fobCurrency} onChange={(e) => setFobCurrency(e.target.value)} className={inputCls}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {showQuestion("countryOfOrigin") && (
          <label className="block text-xs text-muted-foreground">
            Country of export
            <select value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} className={inputCls}>
              {EXPORT_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
        )}
        {!prefill?.carId && (
          <label className="block text-xs text-muted-foreground">
            Shipping method
            <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} className={inputCls}>
              {SHIPPING_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
        )}
        {showQuestion("freight") && (
          <label className="block text-xs text-muted-foreground">
            Freight (GHS) — optional override
            <input value={freightOverride} onChange={(e) => setFreightOverride(e.target.value)} inputMode="decimal" className={inputCls} placeholder="Leave blank to estimate" />
          </label>
        )}
        {showQuestion("insurance") && (
          <label className="block text-xs text-muted-foreground">
            Insurance (GHS) — optional override
            <input value={insuranceOverride} onChange={(e) => setInsuranceOverride(e.target.value)} inputMode="decimal" className={inputCls} placeholder="Leave blank to estimate" />
          </label>
        )}
        {isAdmin && showQuestion("hsCode") && (
          <label className="block text-xs text-muted-foreground sm:col-span-2">
            HS code (expert mode)
            <input value={hsCodeOverride} onChange={(e) => setHsCodeOverride(e.target.value)} className={inputCls} placeholder="870323" />
          </label>
        )}
        {!compact && (
          <>
            <label className="block text-xs text-muted-foreground">
              Transmission
              <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={inputCls}>
                <option value="">— Optional —</option>
                {TRANSMISSIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Drive type
              <select value={driveType} onChange={(e) => setDriveType(e.target.value)} className={inputCls}>
                <option value="">— Optional —</option>
                {DRIVE_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {showQuestion("vin") && (
          <label className="block text-xs text-muted-foreground sm:col-span-2">
            VIN (optional — helps verify specifications)
            <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} className={inputCls} placeholder="17-character VIN" maxLength={17} />
          </label>
        )}
      </div>

      {resolvedSpec && resolvedSpec.needsConfirmation.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium text-amber-800 dark:text-amber-200">Please confirm inferred specifications</p>
          <ul className="mt-2 space-y-2">
            {resolvedSpec.needsConfirmation.map((field) => {
              const inferred = resolvedSpec.inferredFields[field];
              if (!inferred) return null;
              return (
                <li key={field} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{field}: {String(inferred.value)} <span className="text-muted-foreground">({inferred.source})</span></span>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-[11px]"
                    onClick={() => setConfirmedFields((prev) => new Set([...prev, field]))}
                  >
                    Confirm
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
          <button
            type="button"
            onClick={() => void handlePrintReport()}
            disabled={reportPending || !inputPayload}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            {reportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Print report
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          {adminHint && isAdmin && <p className="mt-1 text-xs font-medium">Administrator: {adminHint}</p>}
        </div>
      )}
      {reportError && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {reportError}
        </div>
      )}
      {saveMsg && <p className="mt-3 text-sm text-emerald-600">{saveMsg}</p>}

      {result && (
        <div className="mt-5 space-y-4 border-t border-border pt-4 dark:border-white/10">
          {result.vehicleClassification.profile && (
            <p className="text-xs text-muted-foreground">
              Classification: <span className="font-medium text-foreground">{result.vehicleClassification.profile}</span>
            </p>
          )}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between"><span className="text-muted-foreground">HS Code</span><span className="font-mono">{result.hsCode}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Exchange rate</span><span>1 {result.exchangeRate.fromCurrency} = {result.exchangeRate.rate} GHS</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Calculation date</span><span>{new Date(result.calculatedAt).toLocaleDateString()}</span></div>
            {result.summary.estimatedTransitDays != null ? (
              <div className="flex justify-between"><span className="text-muted-foreground">Est. delivery</span><span>~{result.summary.estimatedTransitDays} days</span></div>
            ) : null}
            <div className="flex justify-between"><span className="text-muted-foreground">FOB</span><span>{formatMoney(result.summary.fobGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping (freight)</span><span>{formatMoney(result.summary.freightGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span>{formatMoney(result.summary.insuranceGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">CIF value</span><span>{formatMoney(result.summary.cifGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated import taxes</span><span>{formatMoney(result.summary.totalGraTaxesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Port charges</span><span>{formatMoney(result.summary.totalPortChargesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping line charges</span><span>{formatMoney(result.summary.shippingLineChargesGhs)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Clearing charges</span><span>{formatMoney(result.summary.agentFeesGhs)}</span></div>
          </div>

          {result.historicalComparison && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
              <p className="font-medium text-blue-700 dark:text-blue-300">Historical comparison</p>
              <p className="mt-1 text-muted-foreground">{result.historicalComparison.note}</p>
              {result.historicalComparison.differencePct != null && (
                <p className="mt-1">Variance: {result.historicalComparison.differencePct}% vs avg actual duty</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated landed cost</p>
            {result.estimateRange && result.estimateRange.bandPct > 0 ? (
              <>
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  {formatMoney(result.estimateRange.landedCostExpectedGhs ?? result.summary.totalLandedCostGhs)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Range {formatMoney(result.estimateRange.landedCostLowGhs ?? result.summary.totalLandedCostGhs)} – {formatMoney(result.estimateRange.landedCostHighGhs ?? result.summary.totalLandedCostGhs)}
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold text-foreground dark:text-white">{formatMoney(result.summary.totalLandedCostGhs)}</p>
            )}
          </div>

          {result.explanation && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs dark:border-white/10">
              <p className="font-medium text-foreground">{result.explanation.profileUsed}</p>
              <p className="mt-1 text-muted-foreground">{result.explanation.whyRangeShown}</p>
              {result.explanation.uncertaintyReasons.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                  {result.explanation.uncertaintyReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {result.confidence.reasons.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5">
                <Check className="h-3 w-3 text-emerald-600" /> {r}
              </span>
            ))}
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
        <DutyIntelligenceSourceNote compact={compact} />
      </div>
    </div>
  );
}
