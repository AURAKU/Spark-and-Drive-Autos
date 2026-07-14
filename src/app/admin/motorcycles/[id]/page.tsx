import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MotorcycleInventoryRowActions } from "@/components/admin/motorcycles/motorcycle-inventory-row-actions";
import { PageHeading } from "@/components/typography/page-headings";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { formatVehiclePriceFromRmb, getGlobalCurrencySettings } from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminMotorcycleDetailPage(props: Props) {
  const { id } = await props.params;
  const motorcycle = await prisma.motorcycle.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 8 },
      videos: { orderBy: { sortOrder: "asc" }, take: 4 },
      specs: { orderBy: { sortOrder: "asc" }, take: 30 },
      _count: { select: { orders: true, favorites: true, images: true, videos: true } },
    },
  });
  if (!motorcycle) notFound();
  const fx = await getGlobalCurrencySettings();

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">{motorcycle.title}</PageHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{motorcycle.slug}</span> · v{motorcycle.version} ·{" "}
            {motorcycle.listingState}
            {motorcycle.deletedAt ? " · SOFT-DELETED" : ""}
          </p>
        </div>
        <MotorcycleInventoryRowActions
          id={motorcycle.id}
          slug={motorcycle.slug}
          title={motorcycle.title}
          year={motorcycle.year}
          brand={motorcycle.brand}
          model={motorcycle.model}
          listingState={motorcycle.listingState}
          deletedAt={motorcycle.deletedAt?.toISOString() ?? null}
          orderCount={motorcycle._count.orders}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border dark:border-white/10">
            {motorcycle.coverImageUrl ? (
              <Image
                src={optimizeCloudinaryUrl(motorcycle.coverImageUrl, "card")}
                alt=""
                fill
                className="object-cover"
                sizes="640px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No cover image
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {motorcycle.images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-[4/3] overflow-hidden rounded-md border border-border dark:border-white/10"
              >
                <Image
                  src={optimizeCloudinaryUrl(img.url, "tableThumb")}
                  alt={img.altText ?? ""}
                  fill
                  className="object-cover"
                  sizes="120px"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Make / model</dt>
              <dd>
                {motorcycle.brand} {motorcycle.model}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Year</dt>
              <dd>{motorcycle.year}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Price</dt>
              <dd>{formatVehiclePriceFromRmb(Number(motorcycle.basePriceRmb), "GHS", fx)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Currency (base)</dt>
              <dd>{motorcycle.basePriceCurrency}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fuel</dt>
              <dd>{engineTypeLabel(motorcycle.engineType)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mileage</dt>
              <dd>{motorcycle.mileage != null ? `${motorcycle.mileage.toLocaleString()} km` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Stock</dt>
              <dd>{motorcycle.location || motorcycle.sourceType.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Availability</dt>
              <dd>{motorcycle.availabilityStatus.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Media</dt>
              <dd>
                {motorcycle._count.images} photos · {motorcycle._count.videos} videos
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Orders / favorites</dt>
              <dd>
                {motorcycle._count.orders} / {motorcycle._count.favorites}
              </dd>
            </div>
          </dl>
          {motorcycle.adminNotes ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
              <p className="font-medium text-amber-100">Admin notes (internal)</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{motorcycle.adminNotes}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/motorcycles/${motorcycle.id}/edit`}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Edit motorcycle
            </Link>
            <Link
              href={`/motorcycles/${motorcycle.slug}`}
              className="rounded-lg border border-border px-4 py-2 text-sm"
              target="_blank"
            >
              Public page
            </Link>
          </div>
        </div>
      </div>

      {motorcycle.specs.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Specifications preview</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {motorcycle.specs.map((s) => (
              <div key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm dark:border-white/10">
                <dt className="text-xs text-muted-foreground">
                  {s.groupName ? `${s.groupName} · ` : ""}
                  {s.label}
                  {!s.isPublic ? " (internal)" : ""}
                </dt>
                <dd>
                  {s.value}
                  {s.unit ? ` ${s.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
