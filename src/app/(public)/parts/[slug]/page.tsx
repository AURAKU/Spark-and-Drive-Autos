import { PartListingState } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";
import { PartImageGallery, buildPartGalleryImageList } from "@/components/parts/part-image-gallery";
import { PartOriginAvailabilityBadge } from "@/components/parts/part-origin-availability-badge";
import { PartDetailActions } from "@/components/parts/part-detail-actions";
import { PartReviewsSection } from "@/components/parts/part-reviews-section";
import { formatConverted, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { getCheckoutLegalVersions } from "@/lib/legal-enforcement";
import { allowedPartCurrencies, getPartDisplayPrice } from "@/lib/parts-pricing";
import { computeChinaQuotesForPartIds } from "@/lib/shipping/parts-china-fees";
import { getPublicAppUrl } from "@/lib/app-url";
import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
import { publicPartDetailSelect } from "@/lib/part-public-data";
import { parsePartOptionsMeta } from "@/lib/part-variant-options";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function tagsList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string");
}

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  const part = await prisma.part.findUnique({
    where: { slug },
    select: { title: true, shortDescription: true, listingState: true },
  });
  if (!part || part.listingState !== PartListingState.PUBLISHED) {
    return { title: "Part | Spark and Drive Autos" };
  }
  return {
    title: `${part.title} | Parts & Accessories`,
    description: part.shortDescription ?? `Parts and accessories for ${part.title}`,
  };
}

export default async function PartDetailPage(props: Props) {
  const { slug } = await props.params;
  const session = await safeAuth();
  const part = await prisma.part.findUnique({
    where: { slug },
    select: publicPartDetailSelect,
  });
  if (!part || part.listingState !== PartListingState.PUBLISHED) {
    notFound();
  }

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const allowedCurrencies = allowedPartCurrencies(part.origin);
  const { amount, currency } = getPartDisplayPrice(
    { origin: part.origin, basePriceRmb: Number(part.basePriceRmb), priceGhs: Number(part.priceGhs) },
    displayCurrency,
    fx,
  );
  const walletPriceGhs = getPartDisplayPrice(
    { origin: part.origin, basePriceRmb: Number(part.basePriceRmb), priceGhs: Number(part.priceGhs) },
    "GHS",
    fx,
  ).amount;
  const cover = part.coverImageUrl;
  const galleryImages = buildPartGalleryImageList(cover, part.images);
  const optionLists = parsePartOptionsMeta(part.metaJson);
  const tags = tagsList(part.tags);
  const me =
    session?.user?.id != null
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            walletBalance: true,
            addresses: {
              where: { isDefault: true },
              take: 1,
              select: { id: true, fullName: true, phone: true, city: true, region: true, streetAddress: true },
            },
          },
        })
      : null;
  const legal = await getCheckoutLegalVersions();
  const favorite =
    session?.user?.id != null
      ? await prisma.partFavorite.findUnique({
          where: { userId_partId: { userId: session.user.id, partId: part.id } },
          select: { id: true },
        })
      : null;
  const chinaQuotes = part.origin === "CHINA" ? await computeChinaQuotesForPartIds([part.id]) : null;
  const shareUrl = `${getPublicAppUrl()}/parts/${part.slug}`;

  return (
    <div className="parts-theme relative [--brand:#ef4444]">
      <div
        className="parts-theme-bg pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(860px 430px at 10% 10%, rgba(239,68,68,0.2), transparent), radial-gradient(720px 380px at 90% 18%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgba(5,5,6,0.95), rgba(9,10,12,0.9)), url('/brand/gear-storefront-theme.png')",
          backgroundBlendMode: "screen,screen,normal,overlay",
          backgroundSize: "auto,auto,auto,cover",
        }}
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/parts" className="inline-flex items-center text-sm font-medium text-[var(--brand)] hover:underline">
        ← Back to catalog
      </Link>
      <nav className="text-sm text-zinc-500">
        <Link href="/parts" className="hover:text-[var(--brand)]">
          Parts &amp; accessories
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-400">{part.category}</span>
      </nav>

      <div className="parts-surface mt-6 grid gap-10 rounded-2xl border border-red-300/20 bg-black/40 p-5 shadow-[0_0_45px_-25px_rgba(239,68,68,0.72)] sm:p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Availability</p>
          <PartOriginAvailabilityBadge part={part} className="w-fit px-3 py-1 text-xs" />
        </div>
        <div>
          <PartImageGallery productTitle={part.title} images={galleryImages} />
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">{part.category}</p>
          <PageHeading variant="product" className="mt-2">
            {part.title}
          </PageHeading>
          <p className="mt-4 text-3xl font-bold text-white">{formatConverted(amount, currency)}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {part.origin === "GHANA"
              ? "Listed in Ghana, priced and settled in GHS."
              : `Listed in China, currency options ${allowedCurrencies.join(" / ")}.`}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Stock: {part.stockQty} · {part.stockStatus.replaceAll("_", " ")}
          </p>
          {optionLists.colors.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Available colors</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {optionLists.colors.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {part.shortDescription ? (
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">{part.shortDescription}</p>
          ) : null}
          {part.description ? (
            <div className="prose prose-invert mt-6 max-w-none text-sm leading-relaxed text-zinc-400 prose-p:my-3">
              {part.description.split("\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}
          {part.origin === "CHINA" ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Delivery options</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {part.deliveryOptions.length === 0 ? (
                  <li className="text-zinc-500">No delivery options configured yet. Contact support for quote.</li>
                ) : (
                  part.deliveryOptions.map((opt) => {
                    const w = opt.template.weightKg != null ? Number(opt.template.weightKg) : null;
                    const cbm = opt.template.volumeCbm != null ? Number(opt.template.volumeCbm) : null;
                    const basis =
                      (w != null && w > 0) || (cbm != null && cbm > 0)
                        ? [w != null && w > 0 ? `${w} kg` : null, cbm != null && cbm > 0 ? `${cbm} CBM` : null]
                            .filter(Boolean)
                            .join(" · ")
                        : null;
                    return (
                      <li key={opt.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-white">{opt.template.name}</p>
                          <p className="text-xs text-zinc-500">{opt.etaLabel ?? opt.template.etaLabel}</p>
                          {basis ? <p className="mt-0.5 text-[11px] text-zinc-600">{basis}</p> : null}
                        </div>
                        <span className="shrink-0 font-medium text-[var(--brand)]">
                          {formatConverted(Number(opt.feeGhs ?? opt.template.feeGhs), "GHS")}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ) : null}
          <div className="mt-10">
            <PartDetailActions
              partId={part.id}
              partSlug={part.slug}
              partTitle={part.title}
              shareUrl={shareUrl}
              shareDescription={part.shortDescription}
              stockQty={part.stockQty}
              unitPrice={walletPriceGhs}
              currency="GHS"
              walletBalance={Number(me?.walletBalance ?? 0)}
              defaultAddress={me?.addresses[0] ?? null}
              isSignedIn={Boolean(session?.user?.id)}
              initialFavorite={Boolean(favorite)}
              agreementVersion={legal.agreementVersion}
              chinaQuotes={chinaQuotes}
              isPreorder={isChinaPreOrderPart(part)}
              optionLists={optionLists}
            />
          </div>
        </div>
      </div>

      <PartReviewsSection partId={part.id} partSlug={part.slug} userId={session?.user?.id ?? null} />
      </div>
    </div>
  );
}
