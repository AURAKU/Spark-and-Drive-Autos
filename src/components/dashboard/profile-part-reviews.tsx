import { ReviewStatus } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

const statusLabel: Record<string, string> = {
  PENDING: "Under review",
  APPROVED: "Published",
  REJECTED: "Removed",
};

export async function ProfilePartReviews({ userId }: { userId: string }) {
  const rows = await prisma.review.findMany({
    where: { userId, partId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 25,
    include: { part: { select: { title: true, slug: true } } },
  });

  if (rows.length === 0) return null;

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold text-white">Your product reviews</h2>
      <p className="mt-1 text-xs text-zinc-500">Parts and accessories you have reviewed (or that are attributed to your account).</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/parts/${r.part?.slug ?? ""}`} className="font-medium text-[var(--brand)] hover:underline">
                {r.part?.title ?? "Product"}
              </Link>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  r.status === ReviewStatus.APPROVED
                    ? "text-emerald-400/90"
                    : r.status === ReviewStatus.PENDING
                      ? "text-amber-300/90"
                      : "text-zinc-500"
                }`}
              >
                {statusLabel[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{r.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
