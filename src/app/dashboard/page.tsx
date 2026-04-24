import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await requireSessionOrRedirect("/dashboard");
  const userId = session.user.id;
  const rawName = session.user.name?.trim();
  const emailHandle = session.user.email?.split("@")[0]?.trim();
  const displayName = rawName || emailHandle || "there";

  const [orders, payments, favorites] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.payment.count({ where: { userId, status: "SUCCESS" } }),
    prisma.favorite.count({ where: { userId } }),
  ]);

  return (
    <div>
      <PageHeading variant="dashboard">Welcome back, {displayName}</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Track orders, payments, and logistics milestones from one place.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Orders", value: orders, href: "/dashboard/orders" },
          { label: "Successful payments", value: payments, href: "/dashboard/payments" },
          { label: "Saved cars", value: favorites, href: "/dashboard/favorites" },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--brand)]/40"
          >
            <p className="text-xs tracking-wide text-zinc-500 uppercase">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
