"use client";

import { useTransition } from "react";

import { rejectAssessmentAction, verifyAssessmentAction } from "@/actions/duty-admin-os";
import { maskBillOfEntry, maskChassis } from "@/lib/duty-assessment/masking";
import { formatMoney } from "@/lib/format";

type Props = {
  data: NonNullable<Awaited<ReturnType<typeof import("@/actions/duty-admin-os").getDutyAdminAssessmentDetailData>>>;
};

export function DutyAssessmentDetailClient({ data }: Props) {
  const [pending, startTransition] = useTransition();
  const { assessment, engineReproduction } = data;
  const profile = assessment.vehicleProfile;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div><span className="text-muted-foreground">BoE ref</span><p className="font-mono">{maskBillOfEntry(assessment.billOfEntryNumber)}</p></div>
        <div><span className="text-muted-foreground">Vehicle</span><p>{profile.make} {profile.model} ({profile.manufactureYear})</p></div>
        <div><span className="text-muted-foreground">HS / fuel</span><p className="font-mono">{profile.hsCode} · {profile.fuelType}</p></div>
        <div><span className="text-muted-foreground">Chassis</span><p className="font-mono">{maskChassis(profile.chassis)}</p></div>
        <div><span className="text-muted-foreground">Customs value</span><p>{formatMoney(Number(assessment.customsValueGhs ?? 0))}</p></div>
        <div><span className="text-muted-foreground">Total assessed</span><p>{formatMoney(Number(assessment.totalAssessedGhs))}</p></div>
        <div><span className="text-muted-foreground">FX rate</span><p>{assessment.fxRate != null ? Number(assessment.fxRate) : "—"}</p></div>
        <div><span className="text-muted-foreground">Verification</span><p>{assessment.verificationStatus}</p></div>
      </div>

      {engineReproduction && (
        <div className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Engine reproduction</h3>
          {engineReproduction.ok ? (
            <p className="mt-2 text-sm">
              Predicted duty {formatMoney(engineReproduction.totalDutyGhs ?? 0)} · variance {formatMoney(engineReproduction.varianceGhs ?? 0)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-destructive">{engineReproduction.message}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Charge</th>
              <th className="px-3 py-2">Normalized key</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {assessment.lines.map((line) => (
              <tr key={line.id} className="border-b border-border/50">
                <td className="px-3 py-2">{line.chargeName}</td>
                <td className="px-3 py-2 font-mono text-xs">{line.normalizedChargeKey}</td>
                <td className="px-3 py-2">{formatMoney(Number(line.amountPayable))}</td>
                <td className="px-3 py-2">{line.matchedReceiptLine ? "Matched" : line.unmatchedReceipt ? "Unmatched" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || assessment.verificationStatus === "VERIFIED"}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => startTransition(async () => {
            await verifyAssessmentAction({ assessmentId: assessment.id, calibrationEligible: true });
            window.location.reload();
          })}
        >
          Mark verified
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive"
          onClick={() => {
            const reason = window.prompt("Rejection reason");
            if (!reason) return;
            startTransition(async () => {
              await rejectAssessmentAction({ assessmentId: assessment.id, reason });
              window.location.reload();
            });
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
