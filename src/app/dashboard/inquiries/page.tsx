import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
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

export default async function DashboardInquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/inquiries");
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.inquiry.count({ where: { userId: session.user.id } });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const rows = await prisma.inquiry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      car: { select: { title: true, slug: true } },
      threads: { take: 1, select: { id: true } },
    },
  });
  const pageHref = (nextPage: number) => (nextPage > 1 ? `/dashboard/inquiries?page=${nextPage}` : "/dashboard/inquiries");

  return (
    <div>
      <PageHeading variant="dashboard">Customer Inquiry</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Replies appear in your <Link href="/dashboard/chats">messages</Link> and in{" "}
        <Link href="/chat">Customer Service Live Support Chat</Link>.
      </p>
      <ul className="mt-8 space-y-3">
        {rows.length === 0 ? (
          <li className="text-sm text-zinc-500">No inquiries yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="font-medium text-white">{r.type.replaceAll("_", " ")}</p>
              <p className="mt-2 text-zinc-400 line-clamp-3">{r.message}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {r.car?.title ?? "General"} · {r.status} · {r.createdAt.toLocaleString()}
              </p>
              {r.threads[0] ? (
                <Link
                  href={`/chat?threadId=${r.threads[0].id}`}
                  className="mt-3 inline-flex text-[var(--brand)] hover:underline"
                >
                  Continue conversation →
                </Link>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Inquiries"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
