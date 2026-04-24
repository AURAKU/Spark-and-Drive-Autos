import { PartListingState } from "@prisma/client";

import { AdminReviewsHubClient } from "@/components/admin/admin-reviews-hub-client";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 15;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminReviewsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.review.count();
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const [rawReviews, partOptions] = await Promise.all([
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { email: true, name: true } },
        part: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.part.findMany({
      where: { listingState: PartListingState.PUBLISHED },
      orderBy: { title: "asc" },
      take: 400,
      select: { id: true, title: true, slug: true },
    }),
  ]);

  const rows = rawReviews.map((r) => ({
    id: r.id,
    status: r.status,
    rating: r.rating,
    body: r.body,
    verifiedPurchase: r.verifiedPurchase,
    createdAt: r.createdAt.toISOString(),
    part: r.part,
    user: r.user,
  }));

  return (
    <div>
      <PageHeading variant="dashboard">Review management</PageHeading>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Moderate customer submissions for parts and accessories, publish reviews on behalf of a buyer account, reassign
        authorship, or remove content. The storefront and profile only show normal customer reviews — attribution never
        shows as staff.
      </p>
      <div className="mt-8">
        <AdminReviewsHubClient rows={rows} partOptions={partOptions} />
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Reviews"
          prevHref={page > 1 ? `/admin/reviews?page=${page - 1}` : null}
          nextHref={page < totalPages ? `/admin/reviews?page=${page + 1}` : null}
        />
      ) : null}
    </div>
  );
}
