"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ingestBillOfEntryAction } from "@/actions/duty-assessment-admin";
import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import type { DutyFuelType } from "@prisma/client";

type ChargeLine = { chargeName: string; amountPayable: string };

const FUEL_TYPES: DutyFuelType[] = ["GASOLINE", "DIESEL", "HYBRID", "PLUGIN_HYBRID", "ELECTRIC"];

export function DutyAssessmentImportClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "fixture">("manual");
  const [lines, setLines] = useState<ChargeLine[]>([
    { chargeName: "Import Duty", amountPayable: "" },
    { chargeName: "Import VAT", amountPayable: "" },
  ]);
  const [form, setForm] = useState({
    billOfEntryNumber: "",
    customsOffice: "Tema",
    assessmentDate: new Date().toISOString().slice(0, 10),
    make: "",
    model: "",
    manufactureYear: String(new Date().getFullYear() - 1),
    fuelType: "GASOLINE" as DutyFuelType,
    hsCode: "",
    engineCc: "",
    powerKw: "",
    customsValueGhs: "",
    totalAssessedGhs: "",
    fobGhs: "",
    freightGhs: "",
    insuranceGhs: "",
    fxRate: "",
  });

  function loadFixture(which: "jetour" | "byd") {
    const fixture = which === "jetour" ? JETOUR_DASHING_CALIBRATION : BYD_SEALION6_CALIBRATION;
    startTransition(async () => {
      setError(null);
      const result = await ingestBillOfEntryAction(fixture);
      if (result.error) setError(result.error);
      else if (result.duplicatePrevented) setError("Duplicate document detected — existing assessment returned.");
      else if (result.assessmentId) router.push(`/admin/duty/assessments/${result.assessmentId}`);
    });
  }

  function submitManual() {
    startTransition(async () => {
      setError(null);
      const parsedLines = lines
        .filter((l) => l.chargeName.trim() && l.amountPayable)
        .map((l, i) => ({
          chargeName: l.chargeName.trim(),
          amountPayable: Number(l.amountPayable),
          displayOrder: i + 1,
        }));

      if (parsedLines.length === 0) {
        setError("Add at least one assessment charge line.");
        return;
      }

      const result = await ingestBillOfEntryAction({
        sourceKind: "ADMIN_IMPORT",
        verificationStatus: "PENDING",
        billOfEntryNumber: form.billOfEntryNumber.trim(),
        customsOffice: form.customsOffice.trim(),
        assessmentDate: new Date(form.assessmentDate),
        customsValueGhs: Number(form.customsValueGhs),
        totalAssessedGhs: Number(form.totalAssessedGhs),
        fobGhs: form.fobGhs ? Number(form.fobGhs) : undefined,
        freightGhs: form.freightGhs ? Number(form.freightGhs) : undefined,
        insuranceGhs: form.insuranceGhs ? Number(form.insuranceGhs) : undefined,
        fxRate: form.fxRate ? Number(form.fxRate) : undefined,
        vehicle: {
          make: form.make.trim(),
          model: form.model.trim(),
          manufactureYear: Number(form.manufactureYear),
          fuelType: form.fuelType,
          hsCode: form.hsCode.trim(),
          engineCc: form.engineCc ? Number(form.engineCc) : undefined,
          powerKw: form.powerKw ? Number(form.powerKw) : undefined,
        },
        lines: parsedLines,
        notes: "Manual admin entry — review all lines before verification.",
      });

      if (result.error) setError(result.error);
      else if (result.duplicatePrevented) setError("Duplicate document detected.");
      else if (result.assessmentId) router.push(`/admin/duty/assessments/${result.assessmentId}`);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload or enter Bill of Entry data. Every line is reviewable before verification — OCR is assistive only.
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("manual")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "manual" ? "bg-muted" : ""}`}>
          Manual entry
        </button>
        <button type="button" onClick={() => setMode("fixture")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "fixture" ? "bg-muted" : ""}`}>
          Calibration fixtures
        </button>
      </div>

      {mode === "fixture" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => loadFixture("jetour")} className="rounded-lg border px-3 py-2 text-sm">
            Import Jetour Dashing fixture
          </button>
          <button type="button" disabled={pending} onClick={() => loadFixture("byd")} className="rounded-lg border px-3 py-2 text-sm">
            Import BYD Sealion 6 fixture
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-4 rounded-xl border border-border p-4 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">BoE number<input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.billOfEntryNumber} onChange={(e) => setForm({ ...form, billOfEntryNumber: e.target.value })} /></label>
            <label className="block text-sm">Customs office<input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.customsOffice} onChange={(e) => setForm({ ...form, customsOffice: e.target.value })} /></label>
            <label className="block text-sm">Assessment date<input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.assessmentDate} onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })} /></label>
            <label className="block text-sm">Make<input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></label>
            <label className="block text-sm">Model<input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
            <label className="block text-sm">Year<input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.manufactureYear} onChange={(e) => setForm({ ...form, manufactureYear: e.target.value })} /></label>
            <label className="block text-sm">HS code<input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} /></label>
            <label className="block text-sm">Fuel type
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value as DutyFuelType })}>
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="block text-sm">Engine cc<input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.engineCc} onChange={(e) => setForm({ ...form, engineCc: e.target.value })} /></label>
            <label className="block text-sm">Customs value (GHS)<input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.customsValueGhs} onChange={(e) => setForm({ ...form, customsValueGhs: e.target.value })} /></label>
            <label className="block text-sm">Total assessed (GHS)<input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.totalAssessedGhs} onChange={(e) => setForm({ ...form, totalAssessedGhs: e.target.value })} /></label>
            <label className="block text-sm">FX rate<input type="number" step="0.0001" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value })} /></label>
          </div>

          <div>
            <p className="text-sm font-medium">Assessment charge lines</p>
            <div className="mt-2 space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Charge name" value={line.chargeName} onChange={(e) => { const next = [...lines]; next[idx] = { ...line, chargeName: e.target.value }; setLines(next); }} />
                  <input type="number" className="w-36 rounded-lg border px-3 py-2 text-sm" placeholder="GHS" value={line.amountPayable} onChange={(e) => { const next = [...lines]; next[idx] = { ...line, amountPayable: e.target.value }; setLines(next); }} />
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-sm text-primary" onClick={() => setLines([...lines, { chargeName: "", amountPayable: "" }])}>
              + Add line
            </button>
          </div>

          <button type="button" disabled={pending} onClick={submitManual} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            Save for review
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
