import { PartListingState } from "@prisma/client";

import { AdminReviewsHubClient } from "@/components/admin/admin-reviews-hub-client";
import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const [rawReviews, partOptions] = await Promise.all([
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
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
    </div>
  );
}
