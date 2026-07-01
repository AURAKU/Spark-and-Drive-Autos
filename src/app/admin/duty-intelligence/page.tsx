import Link from "next/link";

import { getDutyIntelligenceDashboardData } from "@/actions/duty-intelligence-admin";
import { AdminDutyIntelligenceClient } from "@/components/admin/duty-intelligence/admin-duty-intelligence-client";
import { PageHeading } from "@/components/typography/page-headings";

export const metadata = {
  title: "Duty Intelligence Center | Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminDutyIntelligencePage() {
  const data = await getDutyIntelligenceDashboardData();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading variant="dashboard">Duty Intelligence Center V3</PageHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure formulas, shipping costs, insurance rules, exchange rates, and review verified import training data.
        </p>
        <Link
          href="/admin/duty"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Duty tracking
        </Link>
      </div>
      <AdminDutyIntelligenceClient initialData={data} />
    </div>
  );
}
