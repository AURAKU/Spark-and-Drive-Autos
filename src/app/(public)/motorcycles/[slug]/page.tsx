import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { CarGallery } from "@/components/cars/car-gallery";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import { DutyIntelligenceCalculator } from "@/components/duty/duty-intelligence-calculator";
import { MotorcycleCheckoutPayRow } from "@/components/motorcycles/motorcycle-checkout-pay-row";
import { SharePageButton } from "@/components/sharing/share-page-button";
import { PageHeading } from "@/components/typography/page-headings";
import { Badge } from "@/components/ui/badge";
import { CarListingState } from "@prisma/client";

import { globalReservationDepositPercentFromSettings } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { formatVehiclePriceFromRmb, getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCarGalleryImages } from "@/lib/car-gallery";
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
      specs: { orderBy: { sortOrder: "asc" } },
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
        <div>
          <CarGallery images={galleryImages}>
            <VehicleImageStockBadges car={motorcycle} />
          </CarGallery>
        </div>
        <div className="space-y-5">
          <div>
            <PageHeading variant="hero">{motorcycle.title}</PageHeading>
            <p className="mt-2 text-2xl font-bold text-[var(--brand)]">{priceLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {engineTypeLabel(motorcycle.engineType)} · {motorcycle.motorcycleType.replace(/_/g, " ")} · {motorcycle.year}
              {motorcycle.mileage != null ? ` · ${motorcycle.mileage.toLocaleString()} km` : ""}
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

          {motorcycle.specs.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">Specifications</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {motorcycle.specs.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border px-3 py-2 dark:border-white/10">
                    <dt className="text-xs text-muted-foreground">{s.label}</dt>
                    <dd className="text-sm font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
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
                <a href={`/motorcycles/${r.slug}`} className="block rounded-lg border border-border p-3 text-sm hover:border-[var(--brand)] dark:border-white/10">
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
