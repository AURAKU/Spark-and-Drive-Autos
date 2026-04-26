"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { LegalAcceptanceModal } from "@/components/legal/legal-acceptance-modal";
import { PartsFinderDisclaimerNotice } from "@/components/legal/parts-finder-disclaimer-notice";
import { POLICY_KEYS } from "@/lib/legal-enforcement";

type SearchResponse = {
  ok: boolean;
  job?: {
    jobId: string;
    state: "PROCESSING" | "COMPLETE" | "FAILED" | "TIMEOUT";
    cached?: boolean;
    sessionId?: string | null;
  };
  error?: string;
  code?: string;
  policyKey?: string;
};

type JobPollResponse = {
  ok?: boolean;
  id?: string;
  status?: "PROCESSING" | "COMPLETE" | "FAILED" | "TIMEOUT" | "NOT_FOUND";
  result?: { sessionId?: string | null } | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  job?: { sessionId?: string | null; error?: string | null };
};

export function PublicPartsFinderSearch() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [viewResultId, setViewResultId] = useState<string | null>(null);
  const [terminalState, setTerminalState] = useState<null | "COMPLETE" | "FAILED" | "TIMEOUT">(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalPolicyKey, setLegalPolicyKey] = useState<string>(POLICY_KEYS.PARTS_FINDER_DISCLAIMER);
  const [garage, setGarage] = useState<
    Array<{
      id: string;
      vin: string | null;
      make: string;
      model: string;
      year: number;
      engine: string | null;
      trim: string | null;
      nickname: string | null;
      isDefault: boolean;
      nextServiceReminder: string | null;
    }>
  >([]);
  const [formVehicle, setFormVehicle] = useState({
    vin: "",
    chassis: "",
    brand: "",
    model: "",
    year: "",
    engine: "",
    trim: "",
    partDescription: "",
  });
  const [decodeBusy, setDecodeBusy] = useState(false);
  const [decodeMessage, setDecodeMessage] = useState<string | null>(null);
  const [decodedVehicle, setDecodedVehicle] = useState<{
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const pollTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void fetch("/api/garage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { vehicles?: Array<{
        id: string;
        vin: string | null;
        make: string;
        model: string;
        year: number;
        engine: string | null;
        trim: string | null;
        nickname: string | null;
        isDefault: boolean;
        nextServiceReminder: string | null;
      }> } | null) => {
        if (!data?.vehicles) return;
        setGarage(data.vehicles);
        const defaultVehicle = data.vehicles.find((v) => v.isDefault);
        if (defaultVehicle) {
          setFormVehicle((prev) => ({
            ...prev,
            vin: defaultVehicle.vin ?? prev.vin,
            brand: defaultVehicle.make,
            model: defaultVehicle.model,
            year: String(defaultVehicle.year),
            engine: defaultVehicle.engine ?? "",
            trim: defaultVehicle.trim ?? "",
          }));
          setDecodeMessage("Default garage vehicle loaded.");
        }
      })
      .catch(() => {});
  }, []);

  async function decodeVin(saveToGarage = false) {
    const vin = formVehicle.vin.trim();
    if (!vin) {
      setDecodeMessage("Enter a VIN first.");
      return;
    }
    setDecodeBusy(true);
    setDecodeMessage(null);
    const res = await fetch("/api/vin/decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, saveToGarage }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      warning?: string | null;
      vehicle?: {
        year?: number | null;
        make?: string | null;
        model?: string | null;
        engine?: string | null;
        trim?: string | null;
        vin?: string;
        confidence?: "high" | "medium" | "low";
      };
    };
    if (!res.ok || data.ok === false || !data.vehicle) {
      setDecodeBusy(false);
      setDecodeMessage(data.error ?? "Unable to decode VIN right now.");
      return;
    }
    setFormVehicle((prev) => ({
      ...prev,
      vin: data.vehicle?.vin ?? prev.vin,
      year: data.vehicle?.year ? String(data.vehicle.year) : prev.year,
      brand: data.vehicle?.make ?? prev.brand,
      model: data.vehicle?.model ?? prev.model,
      engine: data.vehicle?.engine ?? prev.engine,
      trim: data.vehicle?.trim ?? prev.trim,
    }));
    setDecodedVehicle({
      vin: data.vehicle?.vin ?? vin,
      year: data.vehicle?.year ?? null,
      make: data.vehicle?.make ?? null,
      model: data.vehicle?.model ?? null,
      engine: data.vehicle?.engine ?? null,
      trim: data.vehicle?.trim ?? null,
      confidence: data.vehicle?.confidence ?? "low",
    });
    const identifiedLine = [data.vehicle?.year, data.vehicle?.make, data.vehicle?.model, data.vehicle?.engine]
      .filter(Boolean)
      .join(" ");
    setDecodeMessage(
      data.warning ??
        (identifiedLine
          ? `Vehicle identified: ${identifiedLine}${saveToGarage ? " (saved to My Garage)" : ""}`
          : "Unable to fully decode VIN - using available vehicle details."),
    );
    if (!saveToGarage && identifiedLine) {
      setStatus("Save this vehicle to your garage for faster future searches.");
    }
    if (saveToGarage) {
      void fetch("/api/garage")
        .then((r) => (r.ok ? r.json() : null))
        .then((garageData: { vehicles?: typeof garage } | null) => {
          if (garageData?.vehicles) setGarage(garageData.vehicles);
        })
        .catch(() => {});
    }
    setDecodeBusy(false);
  }

  function applyDecodedVehicle() {
    if (!decodedVehicle) return;
    setFormVehicle((prev) => ({
      ...prev,
      vin: decodedVehicle.vin || prev.vin,
      year: decodedVehicle.year ? String(decodedVehicle.year) : prev.year,
      brand: decodedVehicle.make ?? prev.brand,
      model: decodedVehicle.model ?? prev.model,
      engine: decodedVehicle.engine ?? prev.engine,
      trim: decodedVehicle.trim ?? prev.trim,
    }));
    setDecodeMessage("Decoded vehicle applied to search fields.");
  }

  async function runSearch(payload: Record<string, unknown>) {
    const myPollToken = ++pollTokenRef.current;
    setLoading(true);
    setProgress(5);
    setError(null);
    setViewResultId(null);
    setTerminalState(null);
    setStatus("Submitting search...");
    setLastPayload(payload);

    const res = await fetch("/api/parts-finder/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setProgress(15);
    const data = (await res.json()) as SearchResponse;
    if (!data.ok || !data.job?.jobId) {
      setLoading(false);
      setProgress(0);
      if (data.code === "LEGAL_ACCEPTANCE_REQUIRED") {
        setLegalPolicyKey(data.policyKey ?? POLICY_KEYS.PARTS_FINDER_DISCLAIMER);
        setLegalOpen(true);
      }
      setError(data.error ?? "Search failed.");
      setStatus(null);
      return;
    }

    if (data.job.sessionId) {
      if (pollTokenRef.current !== myPollToken) return;
      setLoading(false);
      setProgress(100);
      setTerminalState("COMPLETE");
      setViewResultId(data.job.sessionId);
      setStatus("Result is ready.");
      return;
    }

    setStatus("Search queued. Gathering evidence...");
    setProgress(30);
    const startedAt = Date.now();
    let optimisticProgress = 30;
    while (Date.now() - startedAt < 75000) {
      if (pollTokenRef.current !== myPollToken) return;
      await new Promise((resolve) => setTimeout(resolve, 2200));
      if (pollTokenRef.current !== myPollToken) return;
      const pollRes = await fetch(`/api/parts-finder/search/jobs/${encodeURIComponent(data.job.jobId)}`, { method: "GET" });
      const poll = (await pollRes.json().catch(() => ({}))) as JobPollResponse;
      if (!pollRes.ok || poll.ok === false) continue;
      if (poll.status === "PROCESSING") {
        setStatus("Analyzing external and internal evidence...");
        optimisticProgress = Math.min(92, optimisticProgress + 5);
        setProgress(optimisticProgress);
        continue;
      }
      if (poll.status === "COMPLETE" && (poll.result?.sessionId ?? poll.job?.sessionId)) {
        setLoading(false);
        setProgress(100);
        setTerminalState("COMPLETE");
        setViewResultId((poll.result?.sessionId ?? poll.job?.sessionId) ?? null);
        setStatus("Search complete.");
        return;
      }
      if (poll.status === "FAILED" || poll.status === "TIMEOUT") {
        setLoading(false);
        setProgress(0);
        setStatus(null);
        setTerminalState(poll.status);
        setError(
          poll.errorMessage ??
            poll.job?.error ??
            (poll.status === "TIMEOUT"
              ? "This search took too long. Please try again."
              : "We could not complete this search. Please try again."),
        );
        return;
      }
    }
    setLoading(false);
    setProgress(0);
    setStatus(null);
    setTerminalState("TIMEOUT");
    setError("Search is taking longer than expected. Please open search history or try again.");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      vin: String(formData.get("vin") ?? "").trim() || undefined,
      chassis: String(formData.get("chassis") ?? "").trim() || undefined,
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      model: String(formData.get("model") ?? "").trim() || undefined,
      year: String(formData.get("year") ?? "").trim() || undefined,
      engine: String(formData.get("engine") ?? "").trim() || undefined,
      trim: String(formData.get("trim") ?? "").trim() || undefined,
      partDescription: String(formData.get("partDescription") ?? "").trim() || undefined,
      partImage:
        formData.get("partImage") instanceof File && (formData.get("partImage") as File).size > 0
          ? {
              fileName: (formData.get("partImage") as File).name,
              mimeType: (formData.get("partImage") as File).type || "application/octet-stream",
              sizeBytes: (formData.get("partImage") as File).size,
            }
          : undefined,
    };
    await runSearch(payload);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="grid gap-2">
          <label htmlFor="vin" className="text-xs font-medium text-muted-foreground">
            Enter VIN for exact match (recommended)
          </label>
          <div className="flex gap-2">
            <input
              id="vin"
              name="vin"
              value={formVehicle.vin}
              onChange={(e) => setFormVehicle((prev) => ({ ...prev, vin: e.target.value.toUpperCase() }))}
              placeholder="17-character VIN"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3"
            />
            <button
              type="button"
              onClick={() => void decodeVin(false)}
              disabled={decodeBusy}
              className="rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
            >
              Decode VIN
            </button>
            <button
              type="button"
              onClick={() => void decodeVin(true)}
              disabled={decodeBusy}
              className="rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
            >
              Save this vehicle
            </button>
          </div>
          {decodeMessage ? <p className="text-xs text-muted-foreground">{decodeMessage}</p> : null}
          {decodedVehicle ? (
            <button
              type="button"
              onClick={applyDecodedVehicle}
              className="w-fit rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/40"
            >
              Use this vehicle
            </button>
          ) : null}
        </div>
        {garage.length > 0 ? (
          <select
            className="h-10 rounded-lg border border-border bg-background px-3"
            value={garage.find((v) => v.vin === formVehicle.vin && v.make === formVehicle.brand && v.model === formVehicle.model)?.id ?? ""}
            onChange={(e) => {
              const selected = garage.find((v) => v.id === e.target.value);
              if (!selected) return;
              setFormVehicle((prev) => ({
                ...prev,
                vin: selected.vin ?? prev.vin,
                brand: selected.make,
                model: selected.model,
                year: String(selected.year),
                engine: selected.engine ?? "",
                trim: selected.trim ?? "",
              }));
            }}
          >
            <option value="">Select from Garage</option>
            {garage.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              </option>
            ))}
          </select>
        ) : null}
        <input
          name="chassis"
          value={formVehicle.chassis}
          onChange={(e) => setFormVehicle((prev) => ({ ...prev, chassis: e.target.value }))}
          placeholder="Chassis (optional)"
          className="h-10 rounded-lg border border-border bg-background px-3"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            name="brand"
            value={formVehicle.brand}
            onChange={(e) => setFormVehicle((prev) => ({ ...prev, brand: e.target.value }))}
            placeholder="Brand"
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
          <input
            name="model"
            value={formVehicle.model}
            onChange={(e) => setFormVehicle((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Model"
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
          <input
            name="year"
            value={formVehicle.year}
            onChange={(e) => setFormVehicle((prev) => ({ ...prev, year: e.target.value }))}
            placeholder="Year"
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="engine"
            value={formVehicle.engine}
            onChange={(e) => setFormVehicle((prev) => ({ ...prev, engine: e.target.value }))}
            placeholder="Engine (optional)"
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
          <input
            name="trim"
            value={formVehicle.trim}
            onChange={(e) => setFormVehicle((prev) => ({ ...prev, trim: e.target.value }))}
            placeholder="Trim (optional)"
            className="h-10 rounded-lg border border-border bg-background px-3"
          />
        </div>
        <textarea
          name="partDescription"
          value={formVehicle.partDescription}
          onChange={(e) => setFormVehicle((prev) => ({ ...prev, partDescription: e.target.value }))}
          placeholder="Describe part needed and symptoms (e.g. front left control arm noise)"
          className="min-h-24 rounded-lg border border-border bg-background p-3"
          required
        />
        <input
          name="partImage"
          type="file"
          accept="image/*"
          className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Optional part image helps context ranking; filename metadata is used, and final fitment still requires VIN/chassis verification.
        </p>
        <PartsFinderDisclaimerNotice version="active" />
        <button
          disabled={loading}
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 font-semibold text-black disabled:opacity-60"
        >
          {loading ? `Searching... ${progress}%` : "Run parts intelligence search"}
        </button>
        {loading ? (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-all duration-500"
                style={{ width: `${progress}%` }}
                aria-hidden
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}% completed</p>
          </div>
        ) : null}
        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
        {terminalState === "COMPLETE" && viewResultId ? (
          <div className="flex gap-2">
            <Link
              href={`/parts-finder/results/${viewResultId}`}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-black"
            >
              View result
            </Link>
          </div>
        ) : null}
        {(terminalState === "FAILED" || terminalState === "TIMEOUT") && lastPayload ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runSearch(lastPayload)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              Try again
            </button>
          </div>
        ) : null}
      </form>
      <LegalAcceptanceModal
        open={legalOpen}
        onOpenChange={setLegalOpen}
        policyKey={legalPolicyKey}
        context="PARTS_FINDER_SEARCH"
        title={legalPolicyKey === POLICY_KEYS.PLATFORM_TERMS_PRIVACY ? "Accept platform terms and privacy" : "Parts Finder legal confirmation"}
        description="Before using Parts Finder, you must agree that results are generated using automated systems and may require verification before use."
        checkboxLabel={
          legalPolicyKey === POLICY_KEYS.PARTS_FINDER_DISCLAIMER
            ? "I understand and accept the Parts Finder Disclaimer."
            : "I agree to the updated Terms and Privacy Policy."
        }
        onAccepted={() => {
          setError(null);
          setStatus("Legal acceptance saved. You can now run search.");
        }}
      />
    </>
  );
}
