import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { CarGallery } from "@/components/cars/car-gallery";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import { DutyIntelligenceCalculator } from "@/components/duty/duty-intelligence-calculator";
import { LazyVideo } from "@/components/media/lazy-video";
import { MotorcycleCheckoutPayRow } from "@/components/motorcycles/motorcycle-checkout-pay-row";
import { SharePageButton } from "@/components/sharing/share-page-button";
import { PageHeading } from "@/components/typography/page-headings";
import { Badge } from "@/components/ui/badge";
import { CarListingState } from "@prisma/client";

import { globalReservationDepositPercentFromSettings } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { formatVehiclePriceFromRmb, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCarGalleryImages } from "@/lib/car-gallery";
import { resolveCarVideoPosterUrl } from "@/lib/car-video-poster";
import { groupPublicSpecs } from "@/lib/motorcycle-specs";
import { computeDepositCheckoutSnapshot } from "@/lib/vehicle-deposit-pricing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  const m = await prisma.motorcycle.findFirst({
    where: { slug, listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } },
    select: { seoTitle: true, seoDescription: true, title: true, coverImageUrl: true },
  });
  if (!m) return { title: "Motorcycle" };
  return {
    title: m.seoTitle ?? m.title,
    description: m.seoDescription ?? undefined,
    openGraph: { title: m.seoTitle ?? m.title, images: m.coverImageUrl ? [{ url: m.coverImageUrl }] : [] },
  };
}

export default async function MotorcycleDetailPage(props: Props) {
  const { slug } = await props.params;
  const motorcycle = await prisma.motorcycle.findFirst({
    where: { slug, listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] },
      specs: { where: { isPublic: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!motorcycle) notFound();

  await prisma.motorcycle.update({ where: { id: motorcycle.id }, data: { viewCount: { increment: 1 } } });

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const priceLabel = formatVehiclePriceFromRmb(Number(motorcycle.basePriceRmb), displayCurrency, fx);
  const globalDepositPct = globalReservationDepositPercentFromSettings(fx);
  const depositSnap = computeDepositCheckoutSnapshot(
    motorcycle,
    fx,
    motorcycle.reservationDepositPercent != null ? Number(motorcycle.reservationDepositPercent) : null,
    globalDepositPct,
  );
  const checkoutBlocked = getCarCheckoutIneligibleReason(motorcycle);
  const galleryImages = buildCarGalleryImages({
    title: motorcycle.title,
    coverImageUrl: motorcycle.coverImageUrl,
    images: motorcycle.images.map((i) => ({ id: i.id, url: i.url, altText: i.altText })),
  });
  const featureTags = Array.isArray(motorcycle.featureTags) ? (motorcycle.featureTags as string[]) : [];
  const highlightTags = Array.isArray(motorcycle.highlightTags) ? (motorcycle.highlightTags as string[]) : [];
  const shareUrl = `${getPublicAppUrl()}/motorcycles/${motorcycle.slug}`;
  const specGroups = groupPublicSpecs(motorcycle.specs);
  const firstStill = motorcycle.coverImageUrl?.trim() || motorcycle.images[0]?.url?.trim() || null;

  const related = await prisma.motorcycle.findMany({
    where: {
      id: { not: motorcycle.id },
      listingState: CarListingState.PUBLISHED,
      OR: [{ brand: motorcycle.brand }, { motorcycleType: motorcycle.motorcycleType }],
    },
    take: 4,
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, coverImageUrl: true, basePriceRmb: true },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <CarGallery images={galleryImages}>
            <VehicleImageStockBadges car={motorcycle} />
          </CarGallery>
          {motorcycle.videos.length > 0 ? (
            <div id="walkthrough" className="scroll-mt-24 space-y-3">
              <div id="vehicle-walkthrough" className="sr-only" aria-hidden />
              <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Walkthrough</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {motorcycle.videos.map((v) => {
                  const poster = resolveCarVideoPosterUrl(v, firstStill);
                  return (
                    <div
                      key={v.id}
                      className="overflow-hidden rounded-2xl border border-border bg-muted/80 dark:border-white/10 dark:bg-black/40"
                    >
                      {v.isFeatured ? (
                        <p className="border-b border-border bg-muted px-3 py-1.5 text-[10px] font-medium tracking-wide text-[var(--brand)] uppercase dark:border-white/10 dark:bg-white/[0.06]">
                          Featured clip
                        </p>
                      ) : null}
                      <div className="p-1">
                        <LazyVideo
                          src={v.url}
                          poster={poster}
                          featured={v.isFeatured}
                          clickToLoad
                          title={v.isFeatured ? "Featured walkthrough video" : "Motorcycle walkthrough video"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-5">
          <div>
            <PageHeading variant="hero">{motorcycle.title}</PageHeading>
            <p className="mt-2 text-2xl font-bold text-[var(--brand)]">{priceLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {engineTypeLabel(motorcycle.engineType)} · {motorcycle.motorcycleType.replace(/_/g, " ")} · {motorcycle.year}
              {motorcycle.mileage != null ? ` · ${motorcycle.mileage.toLocaleString()} km` : ""}
              {motorcycle.location ? ` · ${motorcycle.location}` : ""}
            </p>
          </div>

          {highlightTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {highlightTags.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 rounded-xl border border-border bg-card/95 p-4 backdrop-blur-md dark:border-white/10 lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <MotorcycleCheckoutPayRow
              motorcycleId={motorcycle.id}
              canPayOnline={checkoutBlocked === null}
              blockTitle={motorcycle.title}
              blockMessage={checkoutBlocked ? customerCheckoutBlockedMessage(checkoutBlocked) : ""}
              reserveAvailable={Boolean(depositSnap)}
              reservationDepositGhs={depositSnap?.depositGhs}
              reservationDepositPercentLabel={depositSnap?.depositPercentApplied}
            />
          </div>

          <SharePageButton url={shareUrl} title={motorcycle.title} />

          {motorcycle.longDescription ? (
            <div>
              <h3 className="text-sm font-semibold">Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{motorcycle.longDescription}</p>
            </div>
          ) : null}

          {specGroups.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Specifications</h3>
              {specGroups.map((g) => (
                <div key={g.group ?? "_ungrouped"}>
                  {g.group ? (
                    <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {g.group}
                    </p>
                  ) : null}
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {g.items.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border px-3 py-2 dark:border-white/10">
                        <dt className="text-xs text-muted-foreground">{s.label}</dt>
                        <dd className="text-sm font-medium">
                          {s.value}
                          {s.unit ? ` ${s.unit}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          ) : null}

          {featureTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {featureTags.map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {(motorcycle.sourceType === "IN_CHINA" || motorcycle.sourceType === "IN_TRANSIT") && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Import duty estimate</h3>
          <div className="mt-4">
            <DutyIntelligenceCalculator
              compact
              prefill={{
                manufacturer: motorcycle.brand,
                model: motorcycle.model,
                year: motorcycle.year,
                vin: motorcycle.vin ?? undefined,
                fuelType: motorcycle.engineType,
                engineCc: motorcycle.engineCc ?? undefined,
                fobAmount: Number(motorcycle.basePriceAmount) > 0 ? Number(motorcycle.basePriceAmount) : undefined,
                fobCurrency: motorcycle.basePriceCurrency || "USD",
                countryOfOrigin: motorcycle.sourceType === "IN_CHINA" ? "CHINA" : "CHINA",
              }}
            />
          </div>
        </div>
      )}

      {related.length > 0 ? (
        <section className="mt-12">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Related listings</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.slug}>
                <a
                  href={`/motorcycles/${r.slug}`}
                  className="block rounded-lg border border-border p-3 text-sm hover:border-[var(--brand)] dark:border-white/10"
                >
                  <p className="font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatVehiclePriceFromRmb(Number(r.basePriceRmb), displayCurrency, fx)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
