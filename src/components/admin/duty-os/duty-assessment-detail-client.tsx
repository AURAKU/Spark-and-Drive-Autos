"use client";

import { useTransition } from "react";

import {
  rejectAssessmentAction,
  requestCorrectionAction,
  toggleCalibrationEligibilityAction,
  verifyAssessmentAction,
} from "@/actions/duty-admin-os";
import { isCalibrationEligible } from "@/lib/duty-admin/calibration-eligibility";
import { maskBillOfEntry, maskChassis } from "@/lib/duty-assessment/masking";
import { formatMoney } from "@/lib/format";

type Props = {
  data: NonNullable<Awaited<ReturnType<typeof import("@/actions/duty-admin-os").getDutyAdminAssessmentDetailData>>>;
};

export function DutyAssessmentDetailClient({ data }: Props) {
  const [pending, startTransition] = useTransition();
  const { assessment, engineReproduction } = data;
  const profile = assessment.vehicleProfile;
  const calibrationEligible = isCalibrationEligible(assessment.notes);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <div><span className="text-muted-foreground">BoE ref</span><p className="font-mono">{maskBillOfEntry(assessment.billOfEntryNumber)}</p></div>
        <div><span className="text-muted-foreground">Vehicle</span><p>{profile.make} {profile.model} ({profile.manufactureYear})</p></div>
        <div><span className="text-muted-foreground">HS / fuel</span><p className="font-mono">{profile.hsCode} · {profile.fuelType}</p></div>
        <div><span className="text-muted-foreground">Chassis</span><p className="font-mono">{maskChassis(profile.chassis)}</p></div>
        <div><span className="text-muted-foreground">FOB</span><p>{assessment.fobGhs != null ? formatMoney(Number(assessment.fobGhs)) : "—"}</p></div>
        <div><span className="text-muted-foreground">Freight / insurance</span><p>{formatMoney(Number(assessment.freightGhs ?? 0))} / {formatMoney(Number(assessment.insuranceGhs ?? 0))}</p></div>
        <div><span className="text-muted-foreground">Customs value</span><p>{formatMoney(Number(assessment.customsValueGhs ?? 0))}</p></div>
        <div><span className="text-muted-foreground">Total assessed</span><p>{formatMoney(Number(assessment.totalAssessedGhs))}</p></div>
        <div><span className="text-muted-foreground">FX rate</span><p>{assessment.fxRate != null ? Number(assessment.fxRate) : "—"}</p></div>
        <div><span className="text-muted-foreground">Verification</span><p>{assessment.verificationStatus}</p></div>
        <div><span className="text-muted-foreground">Calibration</span><p>{calibrationEligible ? "Eligible" : "Not eligible"}</p></div>
        {assessment.verifiedBy && (
          <div><span className="text-muted-foreground">Verified by</span><p>{assessment.verifiedBy.name ?? assessment.verifiedBy.email}</p></div>
        )}
      </div>

      {assessment.notes && (
        <div className="rounded-xl border border-border p-4 text-sm dark:border-white/10">
          <h3 className="font-semibold">Admin notes</h3>
          <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{assessment.notes}</pre>
        </div>
      )}

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

      {assessment.predictionOutcomes.length > 0 && (
        <div className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Prediction variance</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {assessment.predictionOutcomes.map((o) => (
              <li key={o.id}>Error {Number(o.percentageError).toFixed(2)}% ({formatMoney(Number(o.absoluteError))})</li>
            ))}
          </ul>
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

      {assessment.documents.length > 0 && (
        <div className="rounded-xl border border-border p-4 text-sm dark:border-white/10">
          <h3 className="font-semibold">Source evidence</h3>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {assessment.documents.map((d) => (
              <li key={d.id}>{d.documentKind} · {d.originalFilename}</li>
            ))}
          </ul>
        </div>
      )}

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
          className="rounded-lg border px-3 py-2 text-sm"
          onClick={() => {
            const reason = window.prompt("Correction request reason");
            if (!reason) return;
            startTransition(async () => {
              await requestCorrectionAction({ assessmentId: assessment.id, reason });
              window.location.reload();
            });
          }}
        >
          Request correction
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
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border px-3 py-2 text-sm"
          onClick={() => startTransition(async () => {
            await toggleCalibrationEligibilityAction({ assessmentId: assessment.id, eligible: !calibrationEligible });
            window.location.reload();
          })}
        >
          {calibrationEligible ? "Remove from calibration" : "Mark calibration eligible"}
        </button>
      </div>
    </div>
  );
}
