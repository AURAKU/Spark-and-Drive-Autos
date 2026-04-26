import { ReviewStatus } from "@prisma/client";
import Link from "next/link";

import { PartReviewForm } from "@/components/parts/part-review-form";
import { prisma } from "@/lib/prisma";

function Stars({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, rating));
  return (
    <span className="text-amber-400" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-zinc-600">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

export async function PartReviewsSection({
  partId,
  partSlug,
  userId,
}: {
  partId: string;
  partSlug: string;
  userId: string | null;
}) {
  const [published, mine] = await Promise.all([
    prisma.review.findMany({
      where: { partId, status: ReviewStatus.APPROVED },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, image: true } } },
    }),
    userId
      ? prisma.review.findFirst({
          where: { partId, userId },
        })
      : null,
  ]);

  const avg =
    published.length > 0
      ? published.reduce((s, r) => s + r.rating, 0) / published.length
      : null;

  return (
    <section className="parts-surface mt-10 rounded-2xl border border-red-300/15 bg-black/35 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Reviews</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Published feedback from buyers. Reviews post immediately and may be removed if they violate policy.
          </p>
        </div>
        {avg != null ? (
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-white">{avg.toFixed(1)}</span> / 5 · {published.length} review
            {published.length === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No published reviews yet.</p>
        )}
      </div>

      <ul className="mt-6 space-y-4">
        {published.map((r) => (
          <li key={r.id} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Stars rating={r.rating} />
              {r.verifiedPurchase ? (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200/90">
                  Verified purchase
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{r.body}</p>
            <p className="mt-2 text-xs text-zinc-500">{r.authorName?.trim() || r.user?.name?.trim() || "Customer"}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-sm font-semibold text-white">Write a review</h3>
        {!userId ? (
          <p className="mt-2 text-sm text-zinc-400">
            <Link href={`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`} className="text-[var(--brand)] hover:underline">
              Sign in
            </Link>{" "}
            to share your experience with this product.
          </p>
        ) : mine?.status === "APPROVED" ? (
          <p className="mt-2 text-sm text-zinc-400">You have already published a review for this product. Thank you.</p>
        ) : mine?.status === "REJECTED" ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-zinc-400">
              Your previous submission was not published. You can send an updated review below.
            </p>
            <PartReviewForm partId={partId} />
          </div>
        ) : (
          <div className="mt-3">
            <PartReviewForm partId={partId} />
          </div>
        )}
      </div>
    </section>
  );
}
