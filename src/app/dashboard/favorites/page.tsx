import Image from "next/image";
import Link from "next/link";

import { FavoritesClientActions } from "@/components/parts/favorites-client-actions";
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

export default async function FavoritesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/favorites");
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.partFavorite.count({ where: { userId: session.user.id } });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const partFavorites = await prisma.partFavorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      part: {
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          coverImageUrl: true,
        },
      },
    },
  });
  const pageHref = (nextPage: number) =>
    nextPage > 1 ? `/dashboard/favorites?page=${nextPage}` : "/dashboard/favorites";

  return (
    <div>
        <PageHeading variant="dashboard">Favorites</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">Save parts you like, remove one item, or clear all favorites.</p>
      <div className="mt-6">
        <FavoritesClientActions hasItems={partFavorites.length > 0} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {partFavorites.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No favorite parts yet.
            <Link href="/parts" className="ml-1 text-[var(--brand)] hover:underline">
              Browse parts
            </Link>
          </p>
        ) : (
          partFavorites.map((fav) => (
            <article key={fav.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                  <Image src={fav.part.coverImageUrl ?? "/brand/logo-emblem.png"} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <Link href={`/parts/${fav.part.slug}`} className="text-sm font-medium text-white hover:text-[var(--brand)]">
                    {fav.part.title}
                  </Link>
                  {fav.part.shortDescription ? (
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{fav.part.shortDescription}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <FavoritesClientActions partId={fav.part.id} />
              </div>
            </article>
          ))
        )}
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Favorite parts"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
