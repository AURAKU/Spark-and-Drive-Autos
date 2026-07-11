import { getDutyAdminCalibrationData } from "@/actions/duty-admin-os";

export const dynamic = "force-dynamic";

export default async function DutyCalibrationPage() {
  const data = await getDutyAdminCalibrationData();

  return (
    <div className="space-y-6 text-sm">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-medium">Sample size: {data.evaluation.sampleCount} verified fixture(s)</p>
        <p className="mt-1 text-muted-foreground">{data.evaluation.note}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MAE" value={String(data.evaluation.mae)} />
        <Stat label="Median abs. error" value={String(data.evaluation.medianAbsoluteError)} />
        <Stat label="Within ±5%" value={data.evaluation.within5Pct != null ? `${data.evaluation.within5Pct}%` : "—"} />
        <Stat label="Within ±10%" value={data.evaluation.within10Pct != null ? `${data.evaluation.within10Pct}%` : "—"} />
      </div>

      {data.insufficientDataWarnings.length > 0 && (
        <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
          {data.insufficientDataWarnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <section className="rounded-xl border border-border p-4 dark:border-white/10">
        <h3 className="font-semibold">Cohort matching</h3>
        <p className="mt-2 text-muted-foreground">Fixtures: {data.cohortFixtures} · Verified imports: {data.verifiedImportCount}</p>
        <p className="text-muted-foreground">Exact matches: {data.exactMatchCount} · Fallback: {data.fallbackMatchCount}</p>
      </section>

      {data.suspectedOutliers.length > 0 && (
        <section className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="font-semibold">Suspected outliers</h3>
          <ul className="mt-2 space-y-1">
            {data.suspectedOutliers.map((o) => (
              <li key={o.id}>{o.label}: {o.errorPct}% error</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4 dark:border-white/10">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
