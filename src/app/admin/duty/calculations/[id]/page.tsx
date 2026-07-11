import { notFound } from "next/navigation";

import { getDutyAdminCalculationDetailData } from "@/actions/duty-admin-os";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DutyCalculationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const row = await getDutyAdminCalculationDetailData(id);
  if (!row) notFound();

  const result = row.resultJson as {
    summary?: { totalGraTaxesGhs?: number; totalLandedCostGhs?: number; customsValueGhs?: number };
    explanation?: { profileUsed?: string; majorAssumptions?: string[] };
    estimateRange?: { lowGhs?: number; highGhs?: number };
  } | null;

  return (
    <div className="space-y-6 text-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-muted-foreground">Reference</span><p className="font-mono">{row.referenceNumber}</p></div>
        <div><span className="text-muted-foreground">HS code</span><p className="font-mono">{row.hsCode}</p></div>
        <div><span className="text-muted-foreground">Profile</span><p>{row.classificationProfileId ?? "—"}</p></div>
        <div><span className="text-muted-foreground">Predicted duty</span><p>{row.predictedTotalGhs != null ? formatMoney(Number(row.predictedTotalGhs)) : "—"}</p></div>
        <div><span className="text-muted-foreground">Landed cost</span><p>{row.totalLandedCostGhs != null ? formatMoney(Number(row.totalLandedCostGhs)) : "—"}</p></div>
        <div><span className="text-muted-foreground">Confidence</span><p>{row.confidenceLevel ?? "—"}</p></div>
        <div><span className="text-muted-foreground">Formula / rule set</span><p>{row.formulaVersion} · {row.ruleSetVersion}</p></div>
        <div><span className="text-muted-foreground">Created</span><p>{new Date(row.createdAt).toLocaleString()}</p></div>
      </div>

      {result?.explanation && (
        <div className="rounded-xl border border-border p-4 dark:border-white/10">
          <p className="font-medium">{result.explanation.profileUsed}</p>
          <ul className="mt-2 list-disc pl-4 text-muted-foreground">
            {result.explanation.majorAssumptions?.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This calculation snapshot is immutable. Rule or FX changes do not retroactively alter saved results.
      </p>
    </div>
  );
}
