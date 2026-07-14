import Image from "next/image";
import Link from "next/link";
import { AvailabilityStatus, EngineType } from "@prisma/client";

import { MotorcycleInventoryRowActions } from "@/components/admin/motorcycles/motorcycle-inventory-row-actions";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { formatVehiclePriceFromRmb, getGlobalCurrencySettings } from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import {
  MOTORCYCLE_ADMIN_PAGE_SIZE,
  motorcycleAdminListHref,
  motorcycleAdminWhere,
  parseMotorcycleAdminFilters,
} from "@/lib/motorcycles";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminMotorcyclesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const filters = parseMotorcycleAdminFilters(sp);
  const where = motorcycleAdminWhere(filters);
  const total = await prisma.motorcycle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / MOTORCYCLE_ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, normalizeIntelListPage(filters.page)), totalPages);
  const fx = await getGlobalCurrencySettings();
  const rows = await prisma.motorcycle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * MOTORCYCLE_ADMIN_PAGE_SIZE,
    take: MOTORCYCLE_ADMIN_PAGE_SIZE,
    include: {
      _count: { select: { orders: true } },
    },
  });

  const stats = await prisma.motorcycle.groupBy({
    by: ["listingState"],
    where: { deletedAt: null },
    _count: true,
  });

  const pageHref = (p: number) => motorcycleAdminListHref(filters, p);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Motorcycle Inventory</PageHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} listings · {stats.map((s) => `${s.listingState}: ${s._count}`).join(" · ")}
          </p>
        </div>
        <Link
          href="/admin/motorcycles/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add motorcycle
        </Link>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-border p-4 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4"
        action="/admin/motorcycles"
        method="get"
      >
        <label className="text-xs text-muted-foreground">
          Search
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Title, brand, slug…"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Make
          <input
            name="brand"
            defaultValue={filters.brand}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Model
          <input
            name="model"
            defaultValue={filters.model}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Year
          <input
            name="year"
            defaultValue={filters.year}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          >
            <option value="">Any</option>
            {Object.values(AvailabilityStatus).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Location
          <input
            name="location"
            defaultValue={filters.location}
            placeholder="Accra / Ghana / China…"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Fuel type
          <select
            name="fuel"
            defaultValue={filters.fuel}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          >
            <option value="">Any</option>
            {Object.values(EngineType).map((e) => (
              <option key={e} value={e}>
                {engineTypeLabel(e)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Transmission
          <input
            name="transmission"
            defaultValue={filters.transmission}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Publication
          <select
            name="published"
            defaultValue={filters.published}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40"
          >
            <option value="">Any (excl. deleted)</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished / draft</option>
            <option value="archived">Archived / hidden</option>
            <option value="deleted">Soft-deleted</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm">
            Apply filters
          </button>
          <Link href="/admin/motorcycles" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:underline">
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Thumb</th>
              <th className="p-3">Make</th>
              <th className="p-3">Model</th>
              <th className="p-3">Year</th>
              <th className="p-3">Price</th>
              <th className="p-3">Currency</th>
              <th className="p-3">Mileage</th>
              <th className="p-3">Fuel</th>
              <th className="p-3">Status</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Listing</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const thumb = m.coverImageUrl
                ? optimizeCloudinaryUrl(m.coverImageUrl, "tableThumb")
                : VEHICLE_IMAGE_PLACEHOLDER_SRC;
              return (
                <tr key={m.id} className={`border-b border-border/50 ${m.deletedAt ? "opacity-60" : ""}`}>
                  <td className="p-2">
                    <div className="relative h-12 w-16 overflow-hidden rounded-md border border-border dark:border-white/10">
                      <Image src={thumb} alt="" fill className="object-cover" sizes="64px" />
                    </div>
                  </td>
                  <td className="p-3 font-medium">{m.brand}</td>
                  <td className="p-3">{m.model}</td>
                  <td className="p-3">{m.year}</td>
                  <td className="p-3">{formatVehiclePriceFromRmb(Number(m.basePriceRmb), "GHS", fx)}</td>
                  <td className="p-3">{m.basePriceCurrency}</td>
                  <td className="p-3">{m.mileage != null ? m.mileage.toLocaleString() : "—"}</td>
                  <td className="p-3">{engineTypeLabel(m.engineType)}</td>
                  <td className="p-3">{m.availabilityStatus.replace(/_/g, " ")}</td>
                  <td className="p-3">{m.location || m.sourceType.replace(/_/g, " ")}</td>
                  <td className="p-3">
                    {m.deletedAt ? "DELETED" : m.listingState}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {m.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="p-3">
                    <MotorcycleInventoryRowActions
                      id={m.id}
                      slug={m.slug}
                      title={m.title}
                      year={m.year}
                      brand={m.brand}
                      model={m.model}
                      listingState={m.listingState}
                      deletedAt={m.deletedAt?.toISOString() ?? null}
                      orderCount={m._count.orders}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ListPaginationFooter
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={MOTORCYCLE_ADMIN_PAGE_SIZE}
        itemLabel="Listings"
        prevHref={page > 1 ? pageHref(page - 1) : null}
        nextHref={page < totalPages ? pageHref(page + 1) : null}
        pageHrefs={totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => pageHref(i + 1)) : undefined}
      />
    </div>
  );
}
