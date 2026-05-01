import Link from "next/link";

import { AdminHealthClient } from "@/app/admin/health/health-client";
import { PageHeading } from "@/components/typography/page-headings";

export const dynamic = "force-dynamic";

export default function AdminHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">System health</PageHeading>
        <p className="mt-2 text-sm text-zinc-500">
          Live readiness from <code className="rounded bg-white/10 px-1 text-xs">/api/admin/health/readiness</code>.
          <code className="ml-2 rounded bg-white/10 px-1 text-xs">ok</code> means database, Paystack, Cloudinary, and
          active legal policy — not every optional integration.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Infrastructure variables and provider tests:{" "}
          <Link className="text-[var(--brand)] hover:underline" href="/admin/settings">
            API Providers and Environment
          </Link>
          .
        </p>
      </div>
      <AdminHealthClient />
    </div>
  );
}
