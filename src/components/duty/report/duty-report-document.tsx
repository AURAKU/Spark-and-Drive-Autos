import Image from "next/image";

import type { DutyReportData } from "@/lib/duty-intelligence/report-model";
import { formatReportMoney } from "@/lib/duty-intelligence/report-model";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!text || text === "undefined" || text === "null" || text === "NaN") return null;
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-2 text-sm sm:grid-cols-[minmax(0,180px)_1fr]">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{text}</dd>
    </div>
  );
}

export function DutyReportDocument({ report }: { report: DutyReportData }) {
  const generatedLabel = (() => {
    try {
      return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(report.generatedAt),
      );
    } catch {
      return report.generatedAt;
    }
  })();

  return (
    <article className="duty-report-sheet mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-sm print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-emblem.png"
            alt="Spark & Drive Autos"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <div>
            <p className="text-lg font-bold tracking-tight text-neutral-900">Spark & Drive Autos</p>
            <p className="text-sm font-semibold text-teal-800">Vehicle Duty & Landed Cost Estimate</p>
          </div>
        </div>
        <div className="text-right text-xs text-neutral-600">
          <p>
            <span className="font-semibold text-neutral-800">Reference:</span> {report.reportReference}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-neutral-800">Generated:</span> {generatedLabel}
          </p>
          {report.ruleSetVersion ? (
            <p className="mt-1">
              <span className="font-semibold text-neutral-800">Rule set:</span> {report.ruleSetVersion}
            </p>
          ) : null}
        </div>
      </header>

      {(report.customer.name || report.customer.email || report.customer.phone) && (
        <section className="border-b border-neutral-100 px-6 py-4 sm:px-8">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Customer</h2>
          <dl className="mt-3 space-y-1.5">
            <Field label="Name" value={report.customer.name} />
            <Field label="Email" value={report.customer.email} />
            <Field label="Phone" value={report.customer.phone} />
          </dl>
        </section>
      )}

      <section className="border-b border-neutral-100 px-6 py-4 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Vehicle details</h2>
        <dl className="mt-3 space-y-1.5">
          <Field label="Make" value={report.vehicle.make} />
          <Field label="Model" value={report.vehicle.model} />
          <Field label="Trim" value={report.vehicle.trim} />
          <Field label="Manufacture year" value={report.vehicle.manufactureYear} />
          <Field label="Powertrain" value={report.vehicle.fuelType} />
          <Field
            label="Engine capacity"
            value={report.vehicle.engineCc != null ? `${report.vehicle.engineCc} cc` : null}
          />
          <Field label="Power output" value={report.vehicle.powerKw != null ? `${report.vehicle.powerKw} kW` : null} />
          <Field label="Transmission" value={report.vehicle.transmission} />
          <Field label="Drivetrain" value={report.vehicle.drivetrain} />
          <Field label="Category" value={report.vehicle.vehicleCategory} />
          <Field label="Seating" value={report.vehicle.seats} />
          <Field label="Weight" value={report.vehicle.weightKg != null ? `${report.vehicle.weightKg} kg` : null} />
          <Field label="VIN / chassis" value={report.vehicle.vinOrChassisMasked} />
          <Field label="HS code" value={report.vehicle.hsCode} />
          <Field label="Origin country" value={report.vehicle.originCountry} />
        </dl>
      </section>

      <section className="border-b border-neutral-100 px-6 py-4 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Cost & valuation</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <tbody>
              {[
                ["Purchase currency", report.costInputs.purchaseCurrency],
                [
                  "FOB (purchase value)",
                  `${report.costInputs.purchaseCurrency} ${report.costInputs.fobForeign.toFixed(2)}`,
                ],
                ["FX rate", `1 ${report.costInputs.purchaseCurrency} = ${report.costInputs.fxRate} GHS`],
                ["FX source", report.costInputs.fxSource],
                ["FX effective date", report.costInputs.fxEffectiveDate],
                ["FOB (GHS)", formatReportMoney(report.costInputs.fobGhs)],
                ["Freight (GHS)", formatReportMoney(report.costInputs.freightGhs)],
                ["Insurance (GHS)", formatReportMoney(report.costInputs.insuranceGhs)],
                ["CIF value (GHS)", formatReportMoney(report.costInputs.cifGhs)],
                ["Customs / assessed value (GHS)", formatReportMoney(report.costInputs.customsValueGhs)],
              ]
                .filter(([, v]) => v != null && String(v).trim() !== "")
                .map(([label, value]) => (
                  <tr key={String(label)} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 text-neutral-500">{label}</td>
                    <td className="py-2 text-right font-medium text-neutral-900">{value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Freight and insurance may be system-derived from shipping matrices unless an override was provided.
        </p>
      </section>

      <section className="border-b border-neutral-100 px-6 py-4 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Duty & charge breakdown</h2>
        <div className="mt-3 space-y-4">
          {report.dutyGroups.map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-semibold text-neutral-800">{group.heading}</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs tracking-wide text-neutral-500 uppercase">
                      <th className="py-2 pr-2 font-semibold">Charge</th>
                      <th className="py-2 pr-2 font-semibold">Taxable base</th>
                      <th className="py-2 pr-2 font-semibold">Rate</th>
                      <th className="py-2 text-right font-semibold">Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((line) => (
                      <tr key={line.code} className="border-b border-neutral-100 break-inside-avoid">
                        <td className="py-2 pr-2 font-medium text-neutral-900">{line.chargeName}</td>
                        <td className="py-2 pr-2 text-neutral-600">{line.taxableBaseLabel}</td>
                        <td className="py-2 pr-2 text-neutral-600">{line.rateLabel ?? "—"}</td>
                        <td className="py-2 text-right font-medium text-neutral-900">
                          {formatReportMoney(line.payableAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {report.dutyLines.length === 0 ? (
            <p className="text-sm text-neutral-600">No charge lines were recorded for this calculation.</p>
          ) : null}
        </div>
      </section>

      <section className="border-b border-neutral-100 px-6 py-5 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Totals</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Estimated duty payable</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">
              {formatReportMoney(report.totals.estimatedDutyPayableGhs)}
            </p>
          </div>
          <div className="rounded-xl border border-teal-700/30 bg-teal-50 px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">Estimated landed cost</p>
            <p className="mt-1 text-2xl font-bold text-teal-900">
              {formatReportMoney(report.totals.estimatedLandedCostGhs)}
            </p>
          </div>
        </div>
        {(report.totals.lowEstimateGhs != null ||
          report.totals.expectedEstimateGhs != null ||
          report.totals.highEstimateGhs != null) && (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            {report.totals.lowEstimateGhs != null ? (
              <p>
                <span className="text-neutral-500">Low:</span>{" "}
                <span className="font-medium">{formatReportMoney(report.totals.lowEstimateGhs)}</span>
              </p>
            ) : null}
            {report.totals.expectedEstimateGhs != null ? (
              <p>
                <span className="text-neutral-500">Expected:</span>{" "}
                <span className="font-medium">{formatReportMoney(report.totals.expectedEstimateGhs)}</span>
              </p>
            ) : null}
            {report.totals.highEstimateGhs != null ? (
              <p>
                <span className="text-neutral-500">High:</span>{" "}
                <span className="font-medium">{formatReportMoney(report.totals.highEstimateGhs)}</span>
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="border-b border-neutral-100 px-6 py-4 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Confidence & assumptions</h2>
        <p className="mt-2 text-sm font-semibold text-neutral-900">{report.confidence.label}</p>
        {report.confidence.reasons.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {report.confidence.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
        {report.assumptions.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Assumptions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {report.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {report.confidence.uncertaintyReasons.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Uncertainty</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {report.confidence.uncertaintyReasons.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="px-6 py-4 sm:px-8">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Disclaimer</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">{report.disclaimer}</p>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-600">
          {report.disclaimerLong.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 px-6 py-4 text-xs text-neutral-600 sm:px-8">
        <div>
          <p className="font-semibold text-neutral-800">Prepared by {report.preparedBy}</p>
          <p className="mt-1">{report.website}</p>
        </div>
        <p>Planning estimate only — not a Ghana Customs assessment.</p>
      </footer>
    </article>
  );
}
