"use client";

import type { EngineType } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

import {
  computeDutyEstimate,
  dutyEstimateInputSchema,
  type DutyEstimateResult,
  type DutyPowertrain,
} from "@/lib/duty/calculator";
import { formatMoney } from "@/lib/format";

import { DutyEstimateDisclosure } from "./duty-estimate-disclosure";
import { DutyOfficialLinks } from "./duty-official-links";

const POWERTRAIN_OPTIONS: { value: DutyPowertrain; label: string }[] = [
  { value: "GASOLINE", label: "Gasoline / diesel (ICE)" },
  { value: "HYBRID", label: "Hybrid (HEV)" },
  { value: "PLUGIN_HYBRID", label: "Plug-in hybrid (PHEV)" },
  { value: "ELECTRIC", label: "Battery electric (BEV)" },
];

type Props = {
  /** When set, pre-fill calculator fields (e.g. from inventory). */
  defaultYear?: number;
  defaultCifGhs?: number;
  /** Pre-select powertrain from listing `engineType`. */
  defaultPowertrain?: EngineType;
  /** If true, show a compact layout for sidebars. */
  compact?: boolean;
};

export function DutyCalculatorPanel({ defaultYear, defaultCifGhs, defaultPowertrain, compact }: Props) {
  const [cifGhs, setCifGhs] = useState(defaultCifGhs != null ? String(Math.round(defaultCifGhs)) : "");
  const [vehicleYear, setVehicleYear] = useState(
    defaultYear != null ? String(defaultYear) : String(new Date().getFullYear() - 3),
  );
  const [powertrain, setPowertrain] = useState<DutyPowertrain>(defaultPowertrain ?? "GASOLINE");
  const [applyEvDutyWaiver, setApplyEvDutyWaiver] = useState(false);
  const [engineCc, setEngineCc] = useState("");
  const [result, setResult] = useState<DutyEstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultPowertrain) setPowertrain(defaultPowertrain);
  }, [defaultPowertrain]);

  useEffect(() => {
    if (powertrain !== "ELECTRIC" && applyEvDutyWaiver) setApplyEvDutyWaiver(false);
  }, [powertrain, applyEvDutyWaiver]);

  const parsedPreview = useMemo(() => {
    const raw = {
      cifGhs: Number(cifGhs),
      vehicleYear: Number(vehicleYear),
      engineCc: engineCc.trim() === "" ? undefined : Number(engineCc),
      powertrain,
      applyEvDutyWaiver,
    };
    return dutyEstimateInputSchema.safeParse(raw);
  }, [cifGhs, vehicleYear, engineCc, powertrain, applyEvDutyWaiver]);

  function runEstimate() {
    setError(null);
    if (!parsedPreview.success) {
      setError("Enter a valid CIF (GHS), year, and powertrain. For BEV, engine cc is not required.");
      setResult(null);
      return;
    }
    setResult(computeDutyEstimate(parsedPreview.data));
  }

  const showCc = powertrain !== "ELECTRIC";

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/40 ${compact ? "p-4" : "p-5"}`}>
      <h3 className="text-sm font-semibold text-white">Duty estimate calculator</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Enter a <span className="text-zinc-400">CIF-style value in GHS</span> (customs valuation basis you are modelling — not necessarily the list price). Rates follow{" "}
        <span className="text-zinc-400">Ghana GRA / ICUMS</span> planning references; BEV uses CET-style duty bands without engine cc.
      </p>
      <div className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <label className="block text-xs text-zinc-400 sm:col-span-2 lg:col-span-1">
          CIF / declared value (GHS)
          <input
            value={cifGhs}
            onChange={(e) => setCifGhs(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="e.g. 185000"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Year of manufacture
          <input
            value={vehicleYear}
            onChange={(e) => setVehicleYear(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Powertrain
          <select
            value={powertrain}
            onChange={(e) => setPowertrain(e.target.value as DutyPowertrain)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {POWERTRAIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {showCc ? (
          <label className="block text-xs text-zinc-400 sm:col-span-2 lg:col-span-1">
            Engine cc (optional, ICE / hybrid)
            <input
              value={engineCc}
              onChange={(e) => setEngineCc(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="e.g. 2000"
            />
          </label>
        ) : (
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <p className="w-full rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] leading-snug text-cyan-100/90">
              Battery electric: no engine displacement. ICUMS classifies by HS (e.g. 8703 electric), VIN, and CIF — use the official calculator to confirm.
            </p>
          </div>
        )}
      </div>
      {powertrain === "ELECTRIC" ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-left text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={applyEvDutyWaiver}
            onChange={(e) => setApplyEvDutyWaiver(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-black/40"
          />
          <span>
            Model <strong className="font-medium text-zinc-300">possible import duty exemption</strong> (e.g. announced relief for qualifying public-transport or assembly
            categories). Personal-use cars may still pay standard CET — confirm with GRA before relying on this.
          </span>
        </label>
      ) : null}
      <button
        type="button"
        onClick={runEstimate}
        className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Calculate estimate
      </button>
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      {result ? (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated total (GHS)</p>
            <p className="text-2xl font-semibold tabular-nums text-[var(--brand)]">{formatMoney(result.totalGhs, "GHS")}</p>
          </div>
          <ul className="space-y-2 text-xs text-zinc-400">
            {result.lines.map((line) => (
              <li key={line.code} className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-zinc-300">{line.label}</span>
                  <span className="font-mono text-[var(--brand)]">{formatMoney(line.amountGhs, "GHS")}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600">{line.basisNote}</p>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-zinc-600">{result.methodologyNote}</p>
          <p className="text-[10px] font-mono text-zinc-600">Formula: {result.formulaVersion}</p>
        </div>
      ) : null}
      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
        <DutyEstimateDisclosure variant="short" />
      </div>
      {!compact ? (
        <div className="mt-5">
          <DutyOfficialLinks />
        </div>
      ) : null}
    </div>
  );
}
