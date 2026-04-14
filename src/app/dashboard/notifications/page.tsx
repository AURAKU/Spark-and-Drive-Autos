import Link from "next/link";

import { markAllNotificationsRead } from "@/actions/notifications";
import { PageHeading } from "@/components/typography/page-headings";
import { NotificationList } from "@/components/dashboard/notification-list";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

const PAGE_SIZE = 15;

export default async function DashboardNotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/notifications");
  const userId = session.user.id;
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");

  const total = await prisma.notification.count({ where: { userId } });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const pageHref = (nextPage: number) =>
    nextPage > 1 ? `/dashboard/notifications?page=${nextPage}` : "/dashboard/notifications";

  const rows = items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.read,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Notifications</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Inquiry updates from our team, payment and order events, and occasional announcements.
          </p>
        </div>
        {rows.some((n) => !n.read) && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>
      <div className="mt-8">
        <NotificationList initial={rows} />
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Notifications"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
      <p className="mt-8 text-sm text-zinc-500">
        <Link href="/dashboard" className="text-[var(--brand)] hover:underline">
          ← Back to overview
        </Link>
      </p>
    </div>
  );
}
