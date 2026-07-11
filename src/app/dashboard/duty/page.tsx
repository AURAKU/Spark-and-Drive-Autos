import Link from "next/link";
import { redirect } from "next/navigation";

import { DutyCalculatorWizard } from "@/components/duty/duty-calculator-wizard";
import { PageHeading } from "@/components/typography/page-headings";
import { getPublicCalculatorConfig } from "@/actions/duty-calculator";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function DashboardDutyPage() {
  const session = await requireActiveSessionOrRedirect("/dashboard/duty");
  const access = await getPublicCalculatorConfig();
  if (!access.enabled) redirect("/dashboard/estimates");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Duty calculator</PageHeading>
          <p className="mt-2 text-sm text-muted-foreground">Create and save import duty estimates for your vehicles.</p>
        </div>
        <Link href="/dashboard/duty/history" className="text-sm text-primary hover:underline">Saved estimates →</Link>
      </div>
      <DutyCalculatorWizard disclaimer={access.disclaimer} isAuthenticated />
    </div>
  );
}
