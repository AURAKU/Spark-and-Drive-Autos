import Link from "next/link";

import { DutyAdminNav } from "@/components/admin/duty-os/duty-admin-nav";
import { PageHeading } from "@/components/typography/page-headings";

import { requireAdmin } from "@/lib/auth-helpers";

export default async function DutyAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Duty Calculator Admin</PageHeading>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Operate, verify, and improve Ghana duty estimates. All changes are audited. Published rules require regression confirmation.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Command center
        </Link>
      </div>
      <DutyAdminNav />
      {children}
    </div>
  );
}
