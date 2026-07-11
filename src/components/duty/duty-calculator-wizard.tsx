"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EngineType } from "@prisma/client";
import { ChevronLeft, ChevronRight, Loader2, Shield } from "lucide-react";

import { saveDutyEstimateAction } from "@/actions/duty-calculator";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import type { IntakeQuestion } from "@/lib/duty-intelligence/intake-questions";
import {
  EXPORT_COUNTRIES,
  SUPPORTED_CURRENCIES,
  type DutyCalculationInput,
  type DutyIntelligenceResult,
} from "@/lib/duty-intelligence/types";
import { resolveDutyDisclaimer } from "@/lib/duty/disclaimer";

import { DutyResultPanel } from "./duty-result-panel";
import { DutyEstimateDisclosure } from "./duty-estimate-disclosure";

const STEPS = ["Vehicle", "Purchase & shipping", "Confirmation", "Result"] as const;
const VEHICLE_CATEGORIES = ["SUV", "SEDAN", "PICKUP", "TRUCK", "BUS", "VAN"] as const;
const SHIPPING_METHODS = ["SEA_FREIGHT", "CONTAINER", "RORO", "AIR_FREIGHT"] as const;

export type VehiclePrefill = {
  carId?: string;
  slug?: string;
  orderId?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  month?: number;
  vin?: string;
  fuelType?: EngineType;
  engineCc?: number;
  powerKw?: number;
  fobAmount?: number;
  fobCurrency?: string;
  countryOfOrigin?: string;
  vehicleCategory?: string;
};

type Props = {
  prefill?: VehiclePrefill;
  disclaimer?: string;
  isAuthenticated?: boolean;
  compact?: boolean;
};

const defaultYear = new Date().getFullYear() - 2;

export function DutyCalculatorWizard({ prefill, disclaimer, isAuthenticated, compact }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DutyIntelligenceResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedRef, setSavedRef] = useState<string | null>(null);
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([]);
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set());

  const [manufacturer, setManufacturer] = useState(prefill?.manufacturer ?? "");
  const [model, setModel] = useState(prefill?.model ?? "");
  const [year, setYear] = useState(String(prefill?.year ?? defaultYear));
  const [month, setMonth] = useState(prefill?.month ? String(prefill.month) : "");
  const [vin, setVin] = useState(prefill?.vin ?? "");
  const [fuelType, setFuelType] = useState<EngineType>(prefill?.fuelType ?? EngineType.GASOLINE_PETROL);
  const [engineCc, setEngineCc] = useState(prefill?.engineCc != null ? String(prefill.engineCc) : "");
  const [powerKw, setPowerKw] = useState(prefill?.powerKw != null ? String(prefill.powerKw) : "");
  const [vehicleCategory, setVehicleCategory] = useState(prefill?.vehicleCategory ?? "SUV");
  const [countryOfOrigin, setCountryOfOrigin] = useState(prefill?.countryOfOrigin ?? "CHINA");
  const [fobAmount, setFobAmount] = useState(prefill?.fobAmount != null ? String(prefill.fobAmount) : "");
  const [fobCurrency, setFobCurrency] = useState(prefill?.fobCurrency ?? "USD");
  const [shippingMethod, setShippingMethod] = useState("SEA_FREIGHT");
  const [freightOverride, setFreightOverride] = useState("");
  const [insuranceOverride, setInsuranceOverride] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [resolvedHs, setResolvedHs] = useState<string | null>(null);

  const showQuestion = useCallback((id: string) => intakeQuestions.some((q) => q.id === id), [intakeQuestions]);

  useEffect(() => {
    if (!manufacturer.trim() || !model.trim()) return;
    const controller = new AbortController();
    fetch("/api/duty-intelligence/intake-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: "GH",
        carId: prefill?.carId,
        vehicle: {
          manufacturer,
          model,
          year: Number(year) || defaultYear,
          fuelType,
          engineCc: engineCc ? Number(engineCc) : undefined,
          powerKw: powerKw ? Number(powerKw) : undefined,
          vehicleCategory,
          countryOfOrigin,
          vin: vin || undefined,
          confirmedFields: [...confirmedFields],
        },
        purchase: { fobAmount: Number(fobAmount) || 0, fobCurrency },
        inferredFromInventory: Boolean(prefill?.carId),
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => { if (d.questions) setIntakeQuestions(d.questions); })
      .catch(() => {});
    return () => controller.abort();
  }, [manufacturer, model, year, fuelType, engineCc, powerKw, vehicleCategory, countryOfOrigin, vin, fobAmount, fobCurrency, prefill?.carId, confirmedFields]);

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
  }, [manufacturer, model, year, vin, countryOfOrigin, vehicleCategory, fuelType, engineCc, powerKw, fobAmount, fobCurrency, shippingMethod, prefill?.carId, freightOverride, insuranceOverride]);

  const runCalculation = useCallback(() => {
    if (!inputPayload) {
      setError("Complete required vehicle and purchase fields.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/duty-intelligence/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Unable to calculate estimate.");
        setResult(null);
        return;
      }
      setResult(data.result);
      setResolvedHs(data.result.hsCode);
      setStep(3);
    });
  }, [inputPayload]);

  function handleSave() {
    if (!result || !inputPayload) return;
    startTransition(async () => {
      const saved = await saveDutyEstimateAction(inputPayload, result);
      if (saved.error) setError(saved.error);
      else if (saved.referenceNumber && saved.id) {
        setSavedRef(saved.referenceNumber);
        setSavedId(saved.id);
        router.push(`/dashboard/duty/${saved.id}`);
      }
    });
  }

  function handleDownloadPdf() {
    if (!savedId) return;
    window.open(`/api/duty-intelligence/calculations/${savedId}/pdf`, "_blank");
  }

  const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15";

  return (
    <div className={`rounded-2xl border border-border bg-card/90 ${compact ? "p-4" : "p-6"} dark:border-white/10`}>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Ghana Duty Calculator</h2>
          <p className="text-xs text-muted-foreground">Step-by-step planning estimate — not a final customs assessment</p>
        </div>
      </div>

      {!compact && (
        <ol className="mt-6 flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 text-xs ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {step === 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Make *<input className={inputCls} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></label>
          <label className="text-sm">Model *<input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} /></label>
          <label className="text-sm">Manufacture year *<input type="number" className={inputCls} value={year} onChange={(e) => setYear(e.target.value)} /></label>
          {showQuestion("manufactureMonth") && (
            <label className="text-sm">Manufacture month<input type="number" min={1} max={12} className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          )}
          <label className="text-sm">Fuel type *
            <select className={inputCls} value={fuelType} onChange={(e) => setFuelType(e.target.value as EngineType)}>
              {Object.values(EngineType).map((t) => <option key={t} value={t}>{engineTypeLabel(t)}</option>)}
            </select>
          </label>
          {fuelType !== "ELECTRIC" && (
            <label className="text-sm">Engine CC *<input type="number" className={inputCls} value={engineCc} onChange={(e) => setEngineCc(e.target.value)} /></label>
          )}
          {fuelType === "ELECTRIC" && (
            <label className="text-sm">Power kW *<input type="number" className={inputCls} value={powerKw} onChange={(e) => setPowerKw(e.target.value)} /></label>
          )}
          {(showQuestion("vehicleCategory") || !prefill?.carId) && (
            <label className="text-sm">Category
              <select className={inputCls} value={vehicleCategory} onChange={(e) => setVehicleCategory(e.target.value)}>
                {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {showQuestion("vin") && (
            <label className="text-sm sm:col-span-2">VIN / chassis (optional)<input className={inputCls} value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} /></label>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">FOB / purchase price *<input type="number" className={inputCls} value={fobAmount} onChange={(e) => setFobAmount(e.target.value)} /></label>
          <label className="text-sm">Currency *
            <select className={inputCls} value={fobCurrency} onChange={(e) => setFobCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-sm">Expected assessment date<input type="date" className={inputCls} value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} /></label>
          {!prefill?.carId && (
            <label className="text-sm">Shipping method
              <select className={inputCls} value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)}>
                {SHIPPING_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm">Freight (GHS) — optional<input type="number" className={inputCls} value={freightOverride} onChange={(e) => setFreightOverride(e.target.value)} placeholder="Suggested if blank" /></label>
          <label className="text-sm">Insurance (GHS) — optional<input type="number" className={inputCls} value={insuranceOverride} onChange={(e) => setInsuranceOverride(e.target.value)} placeholder="Suggested if blank" /></label>
          {showQuestion("countryOfOrigin") && (
            <label className="text-sm">Country of export
              <select className={inputCls} value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)}>
                {EXPORT_COUNTRIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4 text-sm">
          <p className="font-medium">Review before calculating</p>
          <ul className="space-y-2 rounded-lg border p-4 dark:border-white/10">
            <li><strong>Vehicle:</strong> {manufacturer} {model} ({year}) · {engineTypeLabel(fuelType)} {engineCc && `${engineCc}cc`} {powerKw && `${powerKw}kW`}</li>
            <li><strong>Purchase:</strong> {fobAmount} {fobCurrency}</li>
            <li><strong>Shipping:</strong> {shippingMethod.replace(/_/g, " ")}</li>
            {resolvedHs && <li><strong>HS (inferred):</strong> <span className="font-mono">{resolvedHs}</span></li>}
          </ul>
          <p className="text-xs text-muted-foreground">Values shown are assumptions for estimation. You can go back to correct any field.</p>
        </div>
      )}

      {step === 3 && result && inputPayload && (
        <div className="mt-6">
          <DutyResultPanel
            result={result}
            disclaimer={disclaimer}
            referenceNumber={savedRef ?? undefined}
            onSave={isAuthenticated ? handleSave : undefined}
            onPrint={() => window.print()}
            onDownloadPdf={isAuthenticated && savedId ? handleDownloadPdf : undefined}
            onRecalculate={() => setStep(2)}
            onRequestConfirmation={() => router.push("/dashboard/inquiry-requests?topic=duty-confirmation")}
            onRequestSourcing={() => router.push("/dashboard/inquiry-requests?topic=sourcing")}
            onStartSupport={() => router.push("/dashboard/inquiry-requests?topic=support")}
            savePending={pending}
            carId={prefill?.slug}
            orderId={prefill?.orderId}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        {step > 0 && step < 3 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        {step < 2 && (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {step === 2 && (
          <button type="button" disabled={pending} onClick={runCalculation} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Calculate estimate
          </button>
        )}
      </div>

      <div className="mt-6">
        <DutyEstimateDisclosure variant="long" />
        <p className="mt-2 text-xs text-muted-foreground">{resolveDutyDisclaimer(disclaimer)}</p>
      </div>
    </div>
  );
}
