"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  addExchangeRateAction,
  createVerifiedImportAction,
  initializeGhanaDutyConfigAction,
  updateFormulaRuleAction,
  updateInsuranceRuleAction,
  updateShippingCostAction,
  type DutyIntelligenceActionState,
} from "@/actions/duty-intelligence-admin";
import { formatMoney } from "@/lib/format";

type DashboardData = Awaited<ReturnType<typeof import("@/actions/duty-intelligence-admin").getDutyIntelligenceDashboardData>>;

const TABS = [
  "Dashboard",
  "Formulas",
  "Shipping Costs",
  "Insurance Rules",
  "Exchange Rates",
  "HS Codes",
  "Port Charges",
  "Verified Imports",
  "Calculations",
] as const;

type Tab = (typeof TABS)[number];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AdminDutyIntelligenceClient({ initialData }: { initialData: DashboardData }) {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [initPending, startInit] = useTransition();
  const [initMsg, setInitMsg] = useState<string | null>(null);
  const [formulaState, formulaAction] = useFormState(updateFormulaRuleAction, {} as DutyIntelligenceActionState);
  const [rateState, rateAction] = useFormState(addExchangeRateAction, {} as DutyIntelligenceActionState);
  const [importState, importAction] = useFormState(createVerifiedImportAction, {} as DutyIntelligenceActionState);
  const [shippingState, shippingAction] = useFormState(updateShippingCostAction, {} as DutyIntelligenceActionState);
  const [insuranceState, insuranceAction] = useFormState(updateInsuranceRuleAction, {} as DutyIntelligenceActionState);

  const { analytics, health } = initialData;
  const configReady = health?.isReady ?? initialData.config != null;

  function handleInitialize() {
    setInitMsg(null);
    startInit(async () => {
      const result = await initializeGhanaDutyConfigAction();
      if (result.ok) {
        setInitMsg("Ghana duty configuration initialized. Refreshing…");
        window.location.reload();
      } else {
        setInitMsg(result.error ?? "Initialization failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      {!configReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Duty configuration is not ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing: {health?.missing.join(", ") ?? "Ghana configuration"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInitialize}
              disabled={initPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {initPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Initialize Ghana Duty Configuration
            </button>
          </div>
          {initMsg && <p className="mt-2 text-sm text-muted-foreground">{initMsg}</p>}
        </div>
      )}
      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1 dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t ? "bg-background font-medium shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saved calculations" value={String(analytics.totalCalculations)} />
            <StatCard label="Verified imports" value={String(analytics.totalVerifiedImports)} />
            <StatCard
              label="Avg landed cost"
              value={analytics.avgLandedCostGhs > 0 ? formatMoney(analytics.avgLandedCostGhs) : "—"}
            />
            <StatCard
              label="Prediction accuracy"
              value={analytics.avgPredictionErrorPct != null ? `±${analytics.avgPredictionErrorPct}%` : "—"}
              sub={analytics.avgClearanceDays != null ? `Avg clearance ${analytics.avgClearanceDays} days` : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border p-4 dark:border-white/10">
              <h3 className="font-semibold">Monthly imports</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {analytics.monthlyImports.length === 0 && <li className="text-muted-foreground">No verified imports yet.</li>}
                {analytics.monthlyImports.map((m) => (
                  <li key={m.month} className="flex justify-between">
                    <span>{m.month}</span>
                    <span>{m.count} imports · avg {formatMoney(m.avgLandedCost)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border p-4 dark:border-white/10">
              <h3 className="font-semibold">Top imported vehicles</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {analytics.topVehicles.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
                {analytics.topVehicles.map((v) => (
                  <li key={v.label} className="flex justify-between">
                    <span>{v.label}</span>
                    <span>{v.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border p-4 dark:border-white/10">
              <h3 className="font-semibold">Top shipping lines</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {analytics.topShippingLines.map((s) => (
                  <li key={s.name} className="flex justify-between">
                    <span>{s.name}</span>
                    <span>{s.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border p-4 dark:border-white/10">
              <h3 className="font-semibold">Exchange rate trend (USD→GHS)</h3>
              <ul className="mt-3 space-y-1 text-sm font-mono">
                {analytics.exchangeRateTrend.slice(-8).map((r) => (
                  <li key={r.date} className="flex justify-between">
                    <span>{r.date}</span>
                    <span>{r.rate} ({r.source})</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {tab === "Formulas" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Every levy and tax rate is configurable. Updates create a new version and preserve history.
          </p>
          {formulaState.error && <p className="text-sm text-destructive">{formulaState.error}</p>}
          {formulaState.ok && <p className="text-sm text-emerald-600">Formula updated.</p>}
          <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground dark:border-white/10">
                  <th className="p-3">Code</th>
                  <th className="p-3">Label</th>
                  <th className="p-3">Basis</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3">v</th>
                  <th className="p-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {initialData.formulaRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/50 dark:border-white/5">
                    <td className="p-3 font-mono text-xs">{rule.code}</td>
                    <td className="p-3">{rule.label}</td>
                    <td className="p-3">{rule.basis}</td>
                    <td className="p-3">{Number(rule.rateValue)}</td>
                    <td className="p-3">{rule.version}</td>
                    <td className="p-3">
                      <form action={formulaAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <input
                          name="rateValue"
                          defaultValue={String(rule.rateValue)}
                          className="w-24 rounded border border-border px-2 py-1 text-xs dark:border-white/15 dark:bg-black/40"
                        />
                        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Exchange Rates" && (
        <div className="space-y-4">
          {rateState.error && <p className="text-sm text-destructive">{rateState.error}</p>}
          {rateState.ok && <p className="text-sm text-emerald-600">Rate added.</p>}
          <form action={rateAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4 dark:border-white/10">
            <label className="text-xs">
              From
              <select name="fromCurrency" className="mt-1 block rounded border border-border px-2 py-1.5 text-sm dark:border-white/15 dark:bg-black/40">
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
              </select>
            </label>
            <label className="text-xs">
              Rate (→ GHS)
              <input name="rate" type="number" step="0.0001" required className="mt-1 block w-32 rounded border border-border px-2 py-1.5 text-sm dark:border-white/15 dark:bg-black/40" />
            </label>
            <label className="text-xs">
              Source
              <select name="source" className="mt-1 block rounded border border-border px-2 py-1.5 text-sm dark:border-white/15 dark:bg-black/40">
                <option value="CUSTOMS">Customs</option>
                <option value="BANK_OF_GHANA">Bank of Ghana</option>
                <option value="MANUAL_OVERRIDE">Manual override</option>
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Add rate</button>
          </form>
          <ul className="space-y-2 text-sm">
            {initialData.exchangeRates.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border px-3 py-2 dark:border-white/10">
                <span>1 {r.fromCurrency} = {Number(r.rate)} GHS</span>
                <span className="text-muted-foreground">{r.source} · {new Date(r.effectiveDate).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "HS Codes" && (
        <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">HS Code</th>
                <th className="p-3">Description</th>
                <th className="p-3">Fuel</th>
                <th className="p-3">CC range</th>
              </tr>
            </thead>
            <tbody>
              {initialData.hsCodes.map((h) => (
                <tr key={h.id} className="border-b border-border/50">
                  <td className="p-3 font-mono">{h.hsCode}</td>
                  <td className="p-3">{h.description}</td>
                  <td className="p-3">{h.fuelType ?? "—"}</td>
                  <td className="p-3">
                    {h.engineCcMin != null || h.engineCcMax != null
                      ? `${h.engineCcMin ?? 0}–${h.engineCcMax ?? "∞"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Shipping Costs" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Freight rates by origin country, vehicle type, and shipping method. Used automatically by the V3 freight engine.
          </p>
          {shippingState.error && <p className="text-sm text-destructive">{shippingState.error}</p>}
          {shippingState.ok && <p className="text-sm text-emerald-600">Shipping cost updated.</p>}
          <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Origin</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Freight (GHS)</th>
                  <th className="p-3">Transit</th>
                  <th className="p-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {initialData.shippingCostMatrix.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="p-3">{row.originCountry}</td>
                    <td className="p-3">{row.vehicleCategory ?? "All"}</td>
                    <td className="p-3">{row.shippingMethod.replace(/_/g, " ")}</td>
                    <td className="p-3">{formatMoney(Number(row.freightGhs))}</td>
                    <td className="p-3">{row.transitDays != null ? `${row.transitDays} days` : "—"}</td>
                    <td className="p-3">
                      <form action={shippingAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          name="freightGhs"
                          defaultValue={String(row.freightGhs)}
                          className="w-24 rounded border border-border px-2 py-1 text-xs dark:border-white/15 dark:bg-black/40"
                        />
                        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {initialData.shippingCostMatrix.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No shipping costs — initialize configuration first.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Insurance Rules" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Insurance = (FOB + Freight) × percentage rate. Minimum GHS floor applies when configured.
          </p>
          {insuranceState.error && <p className="text-sm text-destructive">{insuranceState.error}</p>}
          {insuranceState.ok && <p className="text-sm text-emerald-600">Insurance rule updated.</p>}
          <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Origin</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Rate %</th>
                  <th className="p-3">Min GHS</th>
                  <th className="p-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {initialData.insuranceRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/50">
                    <td className="p-3">{rule.originCountry ?? "All"}</td>
                    <td className="p-3">{rule.shippingMethod?.replace(/_/g, " ") ?? "All"}</td>
                    <td className="p-3">{(Number(rule.percentageRate) * 100).toFixed(2)}%</td>
                    <td className="p-3">{rule.minimumGhs != null ? formatMoney(Number(rule.minimumGhs)) : "—"}</td>
                    <td className="p-3">
                      <form action={insuranceAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={rule.id} />
                        <input
                          name="percentageRate"
                          defaultValue={String(rule.percentageRate)}
                          step="0.0001"
                          className="w-20 rounded border border-border px-2 py-1 text-xs dark:border-white/15 dark:bg-black/40"
                        />
                        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {initialData.insuranceRules.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No insurance rules — initialize configuration first.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Port Charges" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialData.shippingLines.map((line) => (
            <div key={line.id} className="rounded-xl border border-border p-4 dark:border-white/10">
              <p className="font-semibold">{line.name}</p>
              <p className="text-xs text-muted-foreground">{line.code} · Shipping line charges</p>
              <ul className="mt-2 space-y-1 text-sm">
                {line.chargeTemplates.map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span>{c.label}</span>
                    <span>{c.amountGhs != null ? formatMoney(Number(c.amountGhs)) : "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {tab === "Verified Imports" && (
        <div className="space-y-4">
          {importState.error && <p className="text-sm text-destructive">{importState.error}</p>}
          {importState.ok && <p className="text-sm text-emerald-600">Verified import recorded — calibration updated.</p>}
          <form action={importAction} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10">
            <input name="manufacturer" placeholder="Manufacturer" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <input name="model" placeholder="Model" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <input name="year" type="number" placeholder="Year" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <input name="totalLandedCostGhs" type="number" placeholder="Total landed cost GHS" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <input name="totalDutyGhs" type="number" placeholder="Total duty GHS" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <input name="estimatedDutyGhs" type="number" placeholder="Estimated duty (for learning)" className="rounded border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2 lg:col-span-3">
              Add verified import
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Landed</th>
                  <th className="p-3">Error %</th>
                </tr>
              </thead>
              <tbody>
                {initialData.verifiedImports.map((v) => (
                  <tr key={v.id} className="border-b border-border/50">
                    <td className="p-3">{[v.manufacturer, v.model, v.year].filter(Boolean).join(" ")}</td>
                    <td className="p-3">{v.status}</td>
                    <td className="p-3">{v.totalLandedCostGhs != null ? formatMoney(Number(v.totalLandedCostGhs)) : "—"}</td>
                    <td className="p-3">{v.predictionErrorPct != null ? `${Number(v.predictionErrorPct).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Calculations" && (
        <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Reference</th>
                <th className="p-3">HS</th>
                <th className="p-3">Landed</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {initialData.calculations.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="p-3 font-mono text-xs">{c.referenceNumber}</td>
                  <td className="p-3">{c.hsCode ?? "—"}</td>
                  <td className="p-3">{formatMoney(Number(c.totalLandedCostGhs))}</td>
                  <td className="p-3">{c.confidenceScore != null ? `${Number(c.confidenceScore)}%` : "—"}</td>
                  <td className="p-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
