import Image from "next/image";
import Link from "next/link";

import { CarFavoritesClientActions } from "@/components/cars/car-favorites-client-actions";
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

const PAGE_SIZE = 10;

export default async function FavoritesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/favorites");
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const carPageReq = readPage(sp, "carPage");

  const totalCars = await prisma.favorite.count({ where: { userId: session.user.id } });
  const totalParts = await prisma.partFavorite.count({ where: { userId: session.user.id } });

  const carTotalPages = Math.max(1, Math.ceil(Math.max(0, totalCars) / PAGE_SIZE));
  const partTotalPages = Math.max(1, Math.ceil(Math.max(0, totalParts) / PAGE_SIZE));
  const carPage = Math.min(Math.max(1, carPageReq), carTotalPages);
  const page = Math.min(Math.max(1, pageReq), partTotalPages);

  const carFavorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    skip: (carPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      car: {
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

  const carPageHref = (next: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (next > 1) params.set("carPage", String(next));
    const qs = params.toString();
    return qs ? `/dashboard/favorites?${qs}` : "/dashboard/favorites";
  };

  const partPageHref = (next: number) => {
    const params = new URLSearchParams();
    if (carPage > 1) params.set("carPage", String(carPage));
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    return qs ? `/dashboard/favorites?${qs}` : "/dashboard/favorites";
  };

  return (
    <div>
      <PageHeading variant="dashboard">Favorites</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Saved vehicles and parts in one place. Remove items here or from each product page.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <CarFavoritesClientActions hasCarItems={totalCars > 0} />
        <FavoritesClientActions hasItems={totalParts > 0} />
      </div>

      <h2 className="mt-10 text-sm font-semibold tracking-wide text-zinc-300">Saved vehicles</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {carFavorites.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No saved vehicles yet.
            <Link href="/inventory" className="ml-1 text-[var(--brand)] hover:underline">
              Browse cars
            </Link>
          </p>
        ) : (
          carFavorites.map((fav) => (
            <article key={fav.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                  <Image
                    src={fav.car.coverImageUrl ?? "/brand/logo-emblem.png"}
                    alt={fav.car.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <Link href={`/cars/${fav.car.slug}`} className="text-sm font-medium text-white hover:text-[var(--brand)]">
                    {fav.car.title}
                  </Link>
                  {fav.car.shortDescription ? (
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{fav.car.shortDescription}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <CarFavoritesClientActions carId={fav.car.id} />
              </div>
            </article>
          ))
        )}
      </div>
      {totalCars > 0 ? (
        <ListPaginationFooter
          className="mt-4"
          showPerPageNote
          page={carPage}
          totalPages={carTotalPages}
          totalItems={totalCars}
          pageSize={PAGE_SIZE}
          itemLabel="Saved vehicles"
          prevHref={carPage > 1 ? carPageHref(carPage - 1) : null}
          nextHref={carPage < carTotalPages ? carPageHref(carPage + 1) : null}
        />
      ) : null}

      <h2 className="mt-12 text-sm font-semibold tracking-wide text-zinc-300">Saved parts</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                  <Image
                    src={fav.part.coverImageUrl ?? "/brand/logo-emblem.png"}
                    alt={fav.part.title}
                    fill
                    className="object-cover"
                  />
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
      {totalParts > 0 ? (
        <ListPaginationFooter
          className="mt-4"
          showPerPageNote
          page={page}
          totalPages={partTotalPages}
          totalItems={totalParts}
          pageSize={PAGE_SIZE}
          itemLabel="Saved parts"
          prevHref={page > 1 ? partPageHref(page - 1) : null}
          nextHref={page < partTotalPages ? partPageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
