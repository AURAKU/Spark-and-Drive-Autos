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

const PAGE_SIZE = 10;

export default async function DashboardChatsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/chats");
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.chatThread.count({ where: { customerId: session.user.id } });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const threads = await prisma.chatThread.findMany({
    where: { customerId: session.user.id },
    orderBy: { lastMessageAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { car: { select: { title: true, slug: true } } },
  });
  const publishedReviews = await prisma.review.findMany({
    where: { userId: session.user.id, status: "APPROVED", partId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: { part: { select: { id: true, slug: true, title: true } } },
  });
  const pageHref = (nextPage: number) => (nextPage > 1 ? `/dashboard/chats?page=${nextPage}` : "/dashboard/chats");

  return (
    <div>
      <PageHeading variant="dashboard">Messages</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Continue a thread or start a new chat from{" "}
        <Link className="text-[var(--brand)] hover:underline" href="/chat">
          Customer Service Live Support Chat
        </Link>
        .
      </p>
      <ul className="mt-8 space-y-3">
        {threads.length === 0 ? (
          <li className="text-sm text-zinc-500">No conversations yet.</li>
        ) : (
          threads.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{t.subject ?? "Conversation"}</p>
                  {t.car ? (
                    <p className="mt-1 text-xs text-zinc-500">Re: {t.car.title}</p>
                  ) : null}
                  {t.lastMessageAt ? (
                    <p className="mt-1 text-[10px] text-zinc-600">{t.lastMessageAt.toLocaleString()}</p>
                  ) : null}
                  {t.unreadForCustomer > 0 ? (
                    <span className="mt-2 inline-block rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                      {t.unreadForCustomer} new from team
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/chat?threadId=${t.id}`}
                  className="shrink-0 text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  Open
                </Link>
              </div>
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
          itemLabel="Conversations"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}

      <div className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">Published product reviews</h2>
        <div className="mt-3 space-y-2">
          {publishedReviews.length === 0 ? (
            <p className="text-sm text-zinc-500">No published reviews yet.</p>
          ) : (
            publishedReviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-zinc-500">{r.part?.title ?? "Part review"}</p>
                    <p className="mt-1 text-sm text-zinc-100">{r.body}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Rating: {r.rating}/5</p>
                  </div>
                  {r.part?.slug ? (
                    <Link href={`/parts/${r.part.slug}`} className="text-xs font-medium text-[var(--brand)] hover:underline">
                      View part
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
