import { LEGAL_COMPANY } from "@/lib/legal";
import { formatSheetNumber, type DutyReportData } from "@/lib/duty-intelligence/report-model";

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
      return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(report.generatedAt));
    } catch {
      return report.generatedAt;
    }
  })();

  return (
    <article
      id="duty-estimate-sheet"
      className="duty-report-sheet mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] print:shadow-none"
    >
      <header className="px-6 pt-6 sm:px-10">
        <div className="flex items-start justify-between gap-4 text-[11px] text-neutral-500">
          <p className="font-mono tracking-wide">{report.reportReference}</p>
          <p>{generatedLabel}</p>
        </div>
        <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
          {report.vehicleTitle}
        </h1>
        <div className="mt-5 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
            {/* Regular img so print and PDF-style capture keep the official emblem. */}
            <img
              src="/brand/logo-emblem.png"
              alt={report.company.brandName}
              width={88}
              height={88}
              className="h-[4.4rem] w-[4.4rem] object-contain"
            />
          </div>
          <p className="mt-3 text-sm font-semibold tracking-tight text-neutral-800">{report.company.brandName}</p>
          <a
            href={report.company.websiteUrl}
            className="mt-0.5 text-xs text-teal-800 hover:underline"
          >
            {report.company.websiteHost}
          </a>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-neutral-200 py-4 text-center sm:grid-cols-3 lg:grid-cols-5">
          {report.specChips.map((chip) => (
            <div key={chip.label}>
              <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">{chip.label}</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-900">{chip.value}</dd>
            </div>
          ))}
        </dl>
        {report.vehicle.vinOrChassisMasked ? (
          <p className="mt-3 text-center font-mono text-xs tracking-[0.18em] text-neutral-600">
            {report.vehicle.vinOrChassisMasked}
          </p>
        ) : null}
      </header>

      {(report.customer.name || report.customer.email || report.customer.phone) && (
        <section className="border-b border-neutral-100 px-6 py-4 sm:px-10">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Prepared for</h2>
          <dl className="mt-3 space-y-1.5">
            <Field label="Name" value={report.customer.name} />
            <Field label="Email" value={report.customer.email} />
            <Field label="Phone" value={report.customer.phone} />
          </dl>
        </section>
      )}

      <section className="px-6 py-5 sm:px-10">
        <h2 className="text-base font-semibold text-neutral-900">Taxes &amp; Duty Payable</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] tracking-wide text-neutral-500 uppercase">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Descriptor</th>
                <th className="py-2 pr-2 text-right font-semibold">Base amount</th>
                <th className="py-2 pr-2 text-right font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Payable</th>
              </tr>
            </thead>
            <tbody>
              {report.dutyLines.map((line) => (
                <tr key={line.code} className="border-b border-neutral-100 break-inside-avoid">
                  <td className="py-2 pr-2 font-mono text-neutral-500">{line.lineNo}</td>
                  <td className="py-2 pr-2 font-medium text-neutral-900">{line.chargeName}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-neutral-700">
                    {formatSheetNumber(line.taxableBaseAmount)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-neutral-700">{line.rateLabel ?? "1.00"}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-neutral-900">
                    {formatSheetNumber(line.payableAmount)}
                  </td>
                </tr>
              ))}
              {report.dutyLines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-neutral-600">
                    No charge lines were recorded for this calculation.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-6 text-right">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">Total payable (GHS)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-900">
            {formatSheetNumber(report.totals.estimatedDutyPayableGhs)}
          </p>
          {report.totals.estimatedDutyPayableUsd != null ? (
            <p className="mt-1 text-sm tabular-nums text-neutral-500">
              USD {formatSheetNumber(report.totals.estimatedDutyPayableUsd)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-neutral-100 px-6 py-4 sm:px-10">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Valuation used</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex justify-between gap-3">
            <span className="text-neutral-500">FOB</span>
            <span className="tabular-nums font-medium">{formatSheetNumber(report.costInputs.fobGhs)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-neutral-500">Freight</span>
            <span className="tabular-nums font-medium">{formatSheetNumber(report.costInputs.freightGhs)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-neutral-500">Insurance</span>
            <span className="tabular-nums font-medium">{formatSheetNumber(report.costInputs.insuranceGhs)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-neutral-500">CIF / assessed value</span>
            <span className="tabular-nums font-medium">{formatSheetNumber(report.costInputs.customsValueGhs)}</span>
          </p>
        </div>
      </section>

      <section className="px-6 py-5 sm:px-10">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">Disclaimer</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">{report.disclaimer}</p>
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-neutral-500">
          {report.disclaimerLong.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>
            Prepared by {report.company.brandName} ({report.company.legalName}, {report.company.registrationNumber}).
            Office: {report.company.address}. {LEGAL_COMPANY.phone}. {report.company.websiteHost}.
            Ghana Customs determines the final duty and other government charges at clearance. This document is a
            planning estimate only and is not a Customs assessment.
          </p>
        </div>
      </section>
    </article>
  );
}
