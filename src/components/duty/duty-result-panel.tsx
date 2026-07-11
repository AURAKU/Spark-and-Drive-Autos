"use client";

import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { customerConfidenceLabel } from "@/lib/duty-intelligence/result-labels";
import { groupLineItems } from "@/lib/duty-intelligence/line-item-groups";
import { resolveDutyDisclaimer } from "@/lib/duty/disclaimer";
import { formatMoney } from "@/lib/format";

type Props = {
  result: DutyIntelligenceResult;
  disclaimer?: string;
  referenceNumber?: string;
  onRecalculate?: () => void;
  onSave?: () => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onRequestConfirmation?: () => void;
  onRequestSourcing?: () => void;
  onStartSupport?: () => void;
  savePending?: boolean;
  carId?: string;
  orderId?: string;
};

export function DutyResultPanel({
  result,
  disclaimer,
  referenceNumber,
  onRecalculate,
  onSave,
  onPrint,
  onDownloadPdf,
  onRequestConfirmation,
  onRequestSourcing,
  onStartSupport,
  savePending,
  carId,
  orderId,
}: Props) {
  const groups = groupLineItems(result.lineItems);
  const taxGroups = groups.filter((g) => g.group !== "VALUATION");

  return (
    <div className="space-y-6 print:text-black">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Estimate status</p>
        <p className="mt-1 text-lg font-semibold">{customerConfidenceLabel(result.confidence.level)}</p>
        {referenceNumber && <p className="mt-1 font-mono text-xs text-muted-foreground">Ref {referenceNumber}</p>}
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between"><span className="text-muted-foreground">Customs / CIF value</span><span>{formatMoney(result.summary.customsValueGhs)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Estimated duty payable</span><span className="font-semibold">{formatMoney(result.summary.totalGraTaxesGhs)}</span></div>
        {result.estimateRange && (
          <div className="flex justify-between sm:col-span-2">
            <span className="text-muted-foreground">Duty range (low – high)</span>
            <span>{formatMoney(result.estimateRange.lowGhs ?? result.summary.totalGraTaxesGhs)} – {formatMoney(result.estimateRange.highGhs ?? result.summary.totalGraTaxesGhs)}</span>
          </div>
        )}
        <div className="flex justify-between sm:col-span-2 border-t border-border pt-2">
          <span className="font-medium">Estimated landed cost</span>
          <span className="text-lg font-bold">{formatMoney(result.summary.totalLandedCostGhs)}</span>
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">HS code</span><span className="font-mono">{result.hsCode}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">FX ({result.exchangeRate.fromCurrency})</span><span>{result.exchangeRate.rate} · {new Date(result.exchangeRate.effectiveDate).toLocaleDateString()}</span></div>
      </div>

      {result.explanation && (
        <div className="rounded-lg border border-border p-3 text-sm dark:border-white/10">
          <p className="font-medium">{result.explanation.profileUsed}</p>
          <ul className="mt-2 list-disc pl-4 text-muted-foreground">
            {result.explanation.majorAssumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Charge</th>
              <th className="px-3 py-2">Taxable base</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2 text-right">Est. payable</th>
            </tr>
          </thead>
          <tbody>
            {taxGroups.flatMap((g) =>
              g.items.map((line) => (
                <tr key={line.code} className="border-b border-border/50" title={line.formula}>
                  <td className="px-3 py-2">{line.label}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{line.basis}</td>
                  <td className="px-3 py-2 text-xs">{line.rate != null ? `${(line.rate * 100).toFixed(2)}%` : line.rateType ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(line.amountGhs)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{resolveDutyDisclaimer(disclaimer)}</p>

      <div className="flex flex-wrap gap-2 print:hidden">
        {onSave && (
          <button type="button" disabled={savePending} onClick={onSave} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            Save estimate
          </button>
        )}
        {onPrint && (
          <button type="button" onClick={onPrint} className="rounded-lg border px-4 py-2 text-sm">Print</button>
        )}
        {onDownloadPdf && (
          <button type="button" onClick={onDownloadPdf} className="rounded-lg border px-4 py-2 text-sm">Download PDF</button>
        )}
        {onRecalculate && (
          <button type="button" onClick={onRecalculate} className="rounded-lg border px-4 py-2 text-sm">Recalculate</button>
        )}
        {onRequestConfirmation && (
          <button type="button" onClick={onRequestConfirmation} className="rounded-lg border px-4 py-2 text-sm">Request confirmation</button>
        )}
        {onRequestSourcing && (
          <button type="button" onClick={onRequestSourcing} className="rounded-lg border px-4 py-2 text-sm">Request sourcing</button>
        )}
        {onStartSupport && (
          <button type="button" onClick={onStartSupport} className="rounded-lg border px-4 py-2 text-sm">Start support chat</button>
        )}
        {carId && (
          <a href={`/cars/${carId}`} className="rounded-lg border px-4 py-2 text-sm">View vehicle</a>
        )}
        {orderId && (
          <a href={`/dashboard/orders/${orderId}`} className="rounded-lg border px-4 py-2 text-sm">View order</a>
        )}
      </div>
    </div>
  );
}

export type { DutyCalculationInput, DutyIntelligenceResult };
