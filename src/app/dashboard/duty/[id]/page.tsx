import { notFound } from "next/navigation";
import Link from "next/link";

import { getCustomerDutyDetail } from "@/actions/duty-calculator";
import { DutyResultPanel } from "@/components/duty/duty-result-panel";
import { PageHeading } from "@/components/typography/page-headings";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { getPublicCalculatorAccess } from "@/lib/duty-intelligence/public-access";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DashboardDutyDetailPage({ params }: { params: Params }) {
  await requireActiveSessionOrRedirect("/dashboard/duty");
  const { id } = await params;
  const row = await getCustomerDutyDetail(id);
  if (!row) notFound();

  const access = await getPublicCalculatorAccess();
  const input = row.inputJson as DutyCalculationInput;
  const result = row.resultJson as DutyIntelligenceResult;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Estimate {row.referenceNumber}</PageHeading>
          <p className="mt-2 text-sm text-muted-foreground">Saved {new Date(row.createdAt).toLocaleString()} · immutable snapshot</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/dashboard/duty/history" className="text-primary hover:underline">← History</Link>
          <a href={`/api/duty-intelligence/calculations/${row.id}/pdf`} className="text-primary hover:underline">Download PDF</a>
        </div>
      </div>

      <DutyResultPanel
        result={result}
        disclaimer={access.disclaimer}
        referenceNumber={row.referenceNumber}
        carId={input.carId}
      />

      <p className="text-xs text-muted-foreground">
        This saved estimate reflects rule set {row.ruleSetVersion ?? row.formulaVersion} and FX at calculation time. Updates to rules or rates do not change this record.
      </p>
    </div>
  );
}
