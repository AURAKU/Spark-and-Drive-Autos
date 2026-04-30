import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { CarCheckoutPayRow } from "@/components/cars/car-checkout-pay-row";
import { CarFavoriteButton } from "@/components/cars/car-favorite-button";
import { CarGallery } from "@/components/cars/car-gallery";
import { VehicleImageStockBadges } from "@/components/cars/vehicle-image-stock-badges";
import { DutyCalculatorPanel } from "@/components/duty/duty-calculator-panel";
import { InquiryPanel } from "@/components/inquiry/inquiry-panel";
import { SharePageButton } from "@/components/sharing/share-page-button";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/typography/page-headings";
import { CarListingState } from "@prisma/client";

import {
  formatVehiclePriceFromRmb,
  getCarDisplayPrice,
  getGlobalCurrencySettings,
  parseDisplayCurrency,
} from "@/lib/currency";
import { depositAmountGhsFromFull, resolveReservationDepositPercent } from "@/lib/checkout-amount";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildCarGalleryImages } from "@/lib/car-gallery";
import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const sourceLabel: Record<string, string> = {
  IN_GHANA: "Ghana stock",
  IN_CHINA: "China source",
  IN_TRANSIT: "In transit",
};

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  const car = await prisma.car.findFirst({
    where: { slug, listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } },
    select: { title: true },
  });
  if (!car) return { title: "Vehicle" };
  return { title: car.title };
}

export default async function CarDetailPage(props: Props) {
  const { slug } = await props.params;
  const car = await prisma.car.findFirst({
    where: { slug, listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] },
      specs: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!car) notFound();

  const session = await safeAuth();
  const userId = session?.user?.id;
  const carFavorite =
    userId != null
      ? await prisma.favorite.findUnique({
          where: { userId_carId: { userId, carId: car.id } },
          select: { id: true },
        })
      : null;

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const priceLabel = formatVehiclePriceFromRmb(Number(car.basePriceRmb), displayCurrency, fx);
  const listPriceAsCifHintGhs = getCarDisplayPrice(Number(car.basePriceRmb), "GHS", fx);
  const depositPctStored = car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null;
  const reservationDepositGhs = depositAmountGhsFromFull(listPriceAsCifHintGhs, depositPctStored);
  const reservationDepositPercentLabel = resolveReservationDepositPercent(depositPctStored);

  const galleryImages = buildCarGalleryImages(car);
  const stockBadge = getVehicleStockBadgeForDisplay(car);
  const isSold = stockBadge.variant === "sold";
  const checkoutBlocked = getCarCheckoutIneligibleReason(car);
  const checkoutBlockedMessage = checkoutBlocked ? customerCheckoutBlockedMessage(checkoutBlocked) : null;
  const canPayOnline = checkoutBlocked === null;
  const shareUrl = `${getPublicAppUrl()}/cars/${car.slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {checkoutBlockedMessage ? (
        <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
          <p className="font-semibold text-amber-900 dark:text-amber-50">Online purchase not available</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{checkoutBlockedMessage}</p>
          {isSold ? (
            <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/70">
              This listing may stay visible for reference until operations archives it.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <CarGallery images={galleryImages}>
            <VehicleImageStockBadges car={car} />
          </CarGallery>
          <div className="space-y-3">
            <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Walkthrough</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {car.videos.map((v) => (
                <div key={v.id} className="overflow-hidden rounded-2xl border border-border bg-muted/80 dark:border-white/10 dark:bg-black/40">
                  {v.isFeatured ? (
                    <p className="border-b border-border bg-muted px-3 py-1.5 text-[10px] font-medium tracking-wide text-[var(--brand)] uppercase dark:border-white/10 dark:bg-white/[0.06]">
                      Hero clip
                    </p>
                  ) : null}
                  <video controls className="aspect-video w-full" poster={v.thumbnailUrl ?? undefined} preload="metadata">
                    <source src={v.url} />
                  </video>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{sourceLabel[car.sourceType]}</Badge>
            {stockBadge.variant === "sold" ? (
              <Badge className="border-red-500/60 bg-red-600/25 font-semibold uppercase tracking-wide text-red-100">
                {stockBadge.label}
              </Badge>
            ) : stockBadge.variant === "reserved" ? (
              <Badge className="border-amber-500/50 bg-amber-500/15 font-semibold text-amber-100">
                {stockBadge.label}
              </Badge>
            ) : (
              <Badge variant="outline">{stockBadge.label}</Badge>
            )}
            {car.featured && <Badge>Featured</Badge>}
          </div>
          <PageHeading variant="product" className="mt-4 font-semibold">
            {car.title}
          </PageHeading>
          <p className="mt-2 text-sm text-muted-foreground">
            {car.brand} {car.model} · {car.year}
            {car.trim ? ` · ${car.trim}` : ""}
          </p>
          <p className="mt-6 text-3xl font-semibold text-[var(--brand)]">{priceLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Base CNY {Number(car.basePriceRmb).toLocaleString()} · converted with live admin rates
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{car.location}</p>

          <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-card/90 p-5 text-sm text-card-foreground shadow-sm ring-1 ring-border/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:ring-transparent">
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Engine</span>
              <span>{engineTypeLabel(car.engineType)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Transmission</span>
              <span>{car.transmission ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Mileage</span>
              <span>{car.mileage != null ? `${car.mileage.toLocaleString()} km` : "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Exterior</span>
              <span>{car.colorExterior ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Interior</span>
              <span>{car.colorInterior ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">VIN / chassis</span>
              <span className="text-right">{car.vin ?? "Available on request"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Inspection</span>
              <span>{car.inspectionStatus ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-[var(--brand)]">Delivery window</span>
              <span>{car.estimatedDelivery ?? "—"}</span>
            </div>
            {car.seaShippingFeeGhs != null && Number(car.seaShippingFeeGhs) > 0 ? (
              <div className="flex justify-between gap-4 border-t border-border pt-3 dark:border-white/5">
                <span className="text-muted-foreground">Sea shipping (est.)</span>
                <span className="text-right font-medium text-cyan-700 dark:text-cyan-200/95">
                  {formatMoney(Number(car.seaShippingFeeGhs), "GHS")} · Ghana delivery
                </span>
              </div>
            ) : null}
          </div>

          {(car.sourceType === "IN_CHINA" || car.sourceType === "IN_TRANSIT") && (
            <div className="mt-8">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Import planning</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Rough duty estimate for Ghana arrival — list price is pre-filled as a{" "}
                <span className="font-medium text-foreground">non-CIF</span> placeholder only. Adjust to the valuation you will declare.
              </p>
              <div className="mt-4">
                <DutyCalculatorPanel
                  defaultYear={car.year}
                  defaultCifGhs={listPriceAsCifHintGhs}
                  defaultPowertrain={car.engineType}
                  compact
                />
              </div>
            </div>
          )}

          {car.shortDescription && <p className="mt-6 text-sm leading-relaxed text-foreground/90">{car.shortDescription}</p>}
          {car.longDescription && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{car.longDescription}</p>
          )}

          {car.specs.length > 0 && (
            <div className="mt-8">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Specifications</p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                {car.specs.map((s) => (
                  <li key={s.id} className="flex justify-between gap-4 border-b border-border py-2 dark:border-white/5">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="text-right">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {car.specifications && typeof car.specifications === "object" && !Array.isArray(car.specifications) && (
            <div className="mt-8">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Highlights</p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                {Object.entries(car.specifications as Record<string, string>).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4 border-b border-border py-2 dark:border-white/5">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-right">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <CarCheckoutPayRow
              carId={car.id}
              canPayOnline={canPayOnline}
              blockTitle={car.title}
              blockMessage={checkoutBlockedMessage ?? ""}
              reservationDepositGhs={reservationDepositGhs}
              reservationDepositPercentLabel={reservationDepositPercentLabel}
            />
            <SharePageButton url={shareUrl} title={car.title} text={`${car.title} — Spark and Drive Autos`} />
            <CarFavoriteButton
              carId={car.id}
              carSlug={car.slug}
              isSignedIn={Boolean(userId)}
              initialFavorite={Boolean(carFavorite)}
            />
          </div>

          <div className="mt-12 border-t border-border pt-10 dark:border-white/10">
            <InquiryPanel carId={car.id} title={car.title} disabled={checkoutBlocked === "VEHICLE_SOLD"} />
          </div>
        </div>
      </div>
    </div>
  );
}
