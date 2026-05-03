import Link from "next/link";

import type { UserLegalStatusRow } from "@/lib/legal-profile";

export function DashboardLegalPendingBanner({ pending }: { pending: UserLegalStatusRow[] }) {
  if (pending.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/95">
      <p className="font-semibold text-amber-100">Legal acceptance required</p>
      <p className="mt-1 text-amber-50/90">
        {pending.length} legal document update{pending.length === 1 ? "" : "s"} pending. Complete them once on your profile to unlock checkout and payments.
      </p>
      <Link
        href="/dashboard/profile?view=legal"
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-xs font-semibold text-black hover:opacity-90"
      >
        Open Profile — Legal
      </Link>
    </div>
  );
}
